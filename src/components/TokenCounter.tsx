import React, { useEffect, useState } from "react";
import {
  countTokens,
  formatTokenCount,
  calculateTokenPercentage,
  getTokenLimitColor,
  TOKEN_LIMITS,
  ModelName,
} from "../services/tokenizer";

interface TokenCounterProps {
  text: string;
  modelName?: ModelName;
  showLimit?: boolean;
}

export const TokenCounter: React.FC<TokenCounterProps> = ({
  text,
  modelName = "gpt-4o",
  showLimit = true,
}) => {
  const [tokenCount, setTokenCount] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    setIsCalculating(true);
    // Debounce token counting for performance
    const timer = setTimeout(() => {
      const count = countTokens(text);
      setTokenCount(count);
      setIsCalculating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [text]);

  const limit = TOKEN_LIMITS[modelName];
  const percentage = calculateTokenPercentage(tokenCount, limit);
  const color = getTokenLimitColor(percentage);

  return (
    <div style={{ 
      padding: "12px", 
      border: "1px solid #ddd", 
      borderRadius: "8px",
      backgroundColor: "#f9f9f9"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "8px"
      }}>
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>
          Token Count:
        </span>
        <span style={{ 
          fontSize: "20px", 
          fontWeight: "bold",
          color: showLimit ? color : "#333"
        }}>
          {isCalculating ? "..." : formatTokenCount(tokenCount)}
        </span>
      </div>

      {showLimit && limit > 0 && (
        <>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            Limit: {formatTokenCount(limit)} ({modelName})
          </div>
          <div style={{ 
            width: "100%", 
            height: "8px", 
            backgroundColor: "#e0e0e0",
            borderRadius: "4px",
            overflow: "hidden"
          }}>
            <div
              style={{
                width: `${Math.min(percentage, 100)}%`,
                height: "100%",
                backgroundColor: color,
                transition: "all 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "4px", textAlign: "right" }}>
            {percentage.toFixed(1)}% used
          </div>
          
          {percentage >= 90 && (
            <div style={{ 
              marginTop: "8px",
              padding: "6px",
              backgroundColor: "#ffebee",
              color: "#c62828",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "500"
            }}>
              ⚠️ Warning: Approaching token limit
            </div>
          )}
        </>
      )}
    </div>
  );
};
