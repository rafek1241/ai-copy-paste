import type { UpdateStatus } from "@/types";

export interface FooterPresentationInput {
  tokenCount: number;
  tokenLimit: number;
  redactionCount: number;
  updateStatus?: UpdateStatus;
}

export interface FooterPresentationModel {
  showUpdateScheduledBadge: boolean;
  showTokenUsage: boolean;
  updateScheduledText: string;
  tokenStatusClassName: string;
  tokenUsageText: string;
  redactionText: string | null;
  redactionTitle: string | null;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

function getTokenStatusClass(tokenCount: number, tokenLimit: number): string {
  const safeLimit = tokenLimit <= 0 ? 1 : tokenLimit;
  const percentage = (tokenCount / safeLimit) * 100;

  if (percentage >= 100) {
    return "bg-red-500";
  }

  if (percentage >= 80) {
    return "bg-orange-500";
  }

  return "bg-green-500";
}

export function buildFooterPresentation({
  tokenCount,
  tokenLimit,
  redactionCount,
  updateStatus,
}: FooterPresentationInput): FooterPresentationModel {
  const showUpdateScheduledBadge = updateStatus === "scheduled";
  const showTokenUsage = !showUpdateScheduledBadge;
  const formattedCount = NUMBER_FORMATTER.format(tokenCount);
  const formattedLimit = NUMBER_FORMATTER.format(tokenLimit);

  return {
    showUpdateScheduledBadge,
    showTokenUsage,
    updateScheduledText: "Update will install on exit",
    tokenStatusClassName: getTokenStatusClass(tokenCount, tokenLimit),
    tokenUsageText: `${formattedCount} / ${formattedLimit} tokens`,
    redactionText: redactionCount > 0 ? `${redactionCount} redacted` : null,
    redactionTitle:
      redactionCount > 0 ? `${redactionCount} sensitive items redacted` : null,
  };
}
