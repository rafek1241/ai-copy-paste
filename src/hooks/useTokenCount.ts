import { useState, useEffect, useRef } from 'react';
import { getFileContents } from '../services/prompts';
import { countTokens } from '../services/tokenizer';

interface UseTokenCountResult {
  totalTokens: number;
  isCalculating: boolean;
  error?: Error;
}

export function useTokenCount(paths: string[]): UseTokenCountResult {
  const [totalTokens, setTotalTokens] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  // Cache token counts for file paths: path -> token count
  const tokenCache = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const calculateTokens = async () => {
      try {
        setError(undefined);

        // Identify paths that are not in cache
        const missingPaths = paths.filter(path => !tokenCache.current.has(path));

        if (missingPaths.length > 0) {
          setIsCalculating(true);

          // Fetch content for missing paths
          const contents = await getFileContents(missingPaths);

          if (!isMounted) return;

          // Calculate tokens and update cache
          contents.forEach(file => {
            const tokens = countTokens(file.content);
            tokenCache.current.set(file.path, tokens);
          });
        }

        // Calculate total from all selected paths
        let sum = 0;
        paths.forEach(path => {
          sum += tokenCache.current.get(path) || 0;
        });

        if (isMounted) {
          setTotalTokens(sum);
          setIsCalculating(false);
        }

      } catch (err) {
        if (isMounted) {
          console.error('Error calculating tokens:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setIsCalculating(false);
        }
      }
    };

    calculateTokens();

    return () => {
      isMounted = false;
    };
  }, [paths]);

  return { totalTokens, isCalculating, error };
}
