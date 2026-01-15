import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface ExtractionResult {
  text: string;
  error?: string;
  pageCount?: number;
}

export interface ExtractionProgress {
  current: number;
  total: number;
  status: string;
}

/**
 * Extract text from a PDF file with page-by-page streaming
 */
export async function extractPdfText(
  fileBuffer: ArrayBuffer,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdf = await loadingTask.promise;
    
    const numPages = pdf.numPages;
    const textParts: string[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        onProgress({
          current: pageNum,
          total: numPages,
          status: `Extracting page ${pageNum}/${numPages}`,
        });
      }

      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items with spaces
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        textParts.push(pageText);
      } catch (pageError) {
        console.warn(`Error extracting page ${pageNum}:`, pageError);
        textParts.push(`[Error extracting page ${pageNum}]`);
      }
    }

    return {
      text: textParts.join('\n\n'),
      pageCount: numPages,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract text from a DOCX file
 */
export async function extractDocxText(
  fileBuffer: ArrayBuffer
): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
    
    if (result.messages.length > 0) {
      console.warn('DOCX extraction warnings:', result.messages);
    }

    return {
      text: result.value,
    };
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read file as ArrayBuffer
 */
export async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  // In Tauri, we need to use the fs plugin to read files
  const { readBinaryFile } = await import('@tauri-apps/plugin-fs');
  const contents = await readBinaryFile(filePath);
  return contents.buffer;
}

/**
 * Extract text from a file based on its type
 */
export async function extractText(
  filePath: string,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const extension = filePath.split('.').pop()?.toLowerCase();

  try {
    const fileBuffer = await readFileAsArrayBuffer(filePath);

    switch (extension) {
      case 'pdf':
        return await extractPdfText(fileBuffer, onProgress);
      
      case 'docx':
        return await extractDocxText(fileBuffer);
      
      default:
        return {
          text: '',
          error: `Unsupported file type: ${extension}`,
        };
    }
  } catch (error) {
    console.error('Error reading file:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
