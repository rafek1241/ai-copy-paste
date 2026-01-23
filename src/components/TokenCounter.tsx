import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  countTokens,
  formatTokenCount,
  calculateTokenPercentage,
  getTokenLimitColor,
  TOKEN_LIMITS,
  ModelName,
} from "../services/tokenizer";
import { useTokenCount } from "../hooks/useTokenCount";

interface TokenCounterProps {
  text?: string;
  selectedFileIds?: number[];
  modelName?: ModelName;
  showLimit?: boolean;
  variant?: "default" | "compact";
}

export const TokenCounter: React.FC<TokenCounterProps> = ({
  text = "",
  selectedFileIds = [],
  modelName = "gpt-4o",
  showLimit = true,
  variant = "default",
}) => {
  const [textTokenCount, setTextTokenCount] = useState(0);
  const [isTextCalculating, setIsTextCalculating] = useState(false);
  const { totalTokens: filesTokenCount, isCalculating: isFilesCalculating, error: _error } = useTokenCount(selectedFileIds);

  useEffect(() => {
    if (!text) {
      setTextTokenCount(0);
      return;
    }

    setIsTextCalculating(true);
    // Debounce token counting for performance
    const timer = setTimeout(() => {
      const count = countTokens(text);
      setTextTokenCount(count);
      setIsTextCalculating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [text]);

  const tokenCount = textTokenCount + filesTokenCount;
  const isCalculating = isTextCalculating || isFilesCalculating;

  const limit = TOKEN_LIMITS[modelName];
  const percentage = calculateTokenPercentage(tokenCount, limit);
  const color = getTokenLimitColor(percentage);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground">Tokens:</span>
        <span className={cn(
          percentage >= 90 ? "text-red-500" :
          percentage >= 70 ? "text-yellow-500" : 
          "text-green-500"
        )}>
          {isCalculating ? "..." : formatTokenCount(tokenCount)}
        </span>
        {limit > 0 && (
          <span className="text-xs text-muted-foreground">
            / {formatTokenCount(limit)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-lg bg-card" data-testid="token-counter">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-sm">
          Token Count:
        </span>
        <span className={cn(
          "text-xl font-bold",
          !showLimit && "text-foreground",
          showLimit && color === "#ef4444" && "text-red-500",
          showLimit && color === "#eab308" && "text-yellow-500", 
          showLimit && color === "#22c55e" && "text-green-500"
        )}>
          {isCalculating ? "..." : formatTokenCount(tokenCount)}
        </span>
      </div>

      {showLimit && limit > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-1">
            Limit: {formatTokenCount(limit)} ({modelName})
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-in-out",
                percentage >= 90 ? "bg-red-500" :
                percentage >= 70 ? "bg-yellow-500" : 
                "bg-green-500"
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {percentage.toFixed(1)}% used
          </div>
          
          {percentage >= 90 && (
            <div className="mt-2 p-1.5 bg-destructive/10 text-destructive rounded text-xs font-medium">
              ⚠️ Warning: Approaching token limit
            </div>
          )}
        </>
      )}
    </div>
  );
};
