import { useState, useEffect, useRef } from 'react';
import { getFileContents } from '../services/prompts';
import { countTokens } from '../services/tokenizer';

interface UseTokenCountResult {
  totalTokens: number;
  isCalculating: boolean;
  error?: Error;
}

export function useTokenCount(ids: number[]): UseTokenCountResult {
  const [totalTokens, setTotalTokens] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  
  // Cache token counts for file IDs: id -> token count
  const tokenCache = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const calculateTokens = async () => {
      try {
        setError(undefined);
        
        // Identify IDs that are not in cache
        const missingIds = ids.filter(id => !tokenCache.current.has(id));

        if (missingIds.length > 0) {
          setIsCalculating(true);
          
          // Fetch content for missing IDs
          // Note: In a real large-scale app, we should batch this.
          // For now, we assume standard usage won't select 1000s of new files at once without a robust backend solution.
          const contents = await getFileContents(missingIds);
          
          if (!isMounted) return;

          // Calculate tokens and update cache
          // We use the ID returned from the backend to map correctly
          contents.forEach(file => {
            const tokens = countTokens(file.content);
            tokenCache.current.set(file.id, tokens);
          });
        }

        // Calculate total from all selected IDs
        // If a file failed to load (no content returned), it treats tokens as 0 (via cache miss or 0)
        // Ideally we should handle errors per file, but for now we sum what we have.
        let sum = 0;
        ids.forEach(id => {
          sum += tokenCache.current.get(id) || 0;
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
  }, [ids]);

  return { totalTokens, isCalculating, error };
}
