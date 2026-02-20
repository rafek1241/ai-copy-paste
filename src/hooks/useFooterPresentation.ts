import { useMemo } from "react";
import {
  buildFooterPresentation,
  type FooterPresentationInput,
  type FooterPresentationModel,
} from "@/services/footerPresentation";

export type { FooterPresentationInput, FooterPresentationModel };

export function useFooterPresentation(
  input: FooterPresentationInput
): FooterPresentationModel {
  const { tokenCount, tokenLimit, redactionCount, updateStatus } = input;

  return useMemo(
    () =>
      buildFooterPresentation({
        tokenCount,
        tokenLimit,
        redactionCount,
        updateStatus,
      }),
    [tokenCount, tokenLimit, redactionCount, updateStatus]
  );
}
