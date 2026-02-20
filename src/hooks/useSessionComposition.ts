import { useSessionPersistence } from "@/hooks/useSessionPersistence";

interface UseSessionCompositionParams {
  selectedPaths: string[];
  customInstructions: string;
  setSelectedPaths: (paths: string[]) => void;
  setCustomInstructions: (instructions: string) => void;
}

export function useSessionComposition({
  selectedPaths,
  customInstructions,
  setSelectedPaths,
  setCustomInstructions,
}: UseSessionCompositionParams) {
  return useSessionPersistence(
    selectedPaths,
    customInstructions,
    setSelectedPaths,
    setCustomInstructions
  );
}
