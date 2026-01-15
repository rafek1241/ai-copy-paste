import { encode, isWithinTokenLimit } from 'gpt-tokenizer/model/gpt-4o';

/**
 * Count tokens for a given text using GPT-4o tokenizer
 */
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch (error) {
    console.error('Error counting tokens:', error);
    return 0;
  }
}

/**
 * Check if text is within a specific token limit
 * More efficient than counting all tokens
 */
export function checkTokenLimit(text: string, limit: number): boolean | number {
  try {
    return isWithinTokenLimit(text, limit);
  } catch (error) {
    console.error('Error checking token limit:', error);
    return false;
  }
}

/**
 * Count tokens for multiple text items
 */
export function countTotalTokens(texts: string[]): number {
  return texts.reduce((total, text) => total + countTokens(text), 0);
}

/**
 * Format token count with thousands separator
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Calculate percentage of token limit used
 */
export function calculateTokenPercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

/**
 * Get color based on token usage percentage
 */
export function getTokenLimitColor(percentage: number): string {
  if (percentage >= 90) return '#ff4444'; // Red
  if (percentage >= 75) return '#ffaa00'; // Orange
  if (percentage >= 50) return '#ffdd00'; // Yellow
  return '#44ff44'; // Green
}

/**
 * Token limit presets for different AI models
 */
export const TOKEN_LIMITS = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'gemini-pro': 32768,
  'custom': 0,
} as const;

export type ModelName = keyof typeof TOKEN_LIMITS;
