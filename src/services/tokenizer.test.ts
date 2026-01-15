import { describe, it, expect } from 'vitest';
import {
  countTokens,
  checkTokenLimit,
  countTotalTokens,
  formatTokenCount,
  calculateTokenPercentage,
  getTokenLimitColor,
  TOKEN_LIMITS,
} from './tokenizer';

describe('tokenizer', () => {
  describe('countTokens', () => {
    it('should count tokens for simple text', () => {
      const result = countTokens('Hello world');
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should return 0 for empty string', () => {
      const result = countTokens('');
      expect(result).toBe(0);
    });

    it('should handle longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens.';
      const result = countTokens(text);
      expect(result).toBeGreaterThan(countTokens('Hello'));
    });
  });

  describe('checkTokenLimit', () => {
    it('should return true when text is within limit', () => {
      const result = checkTokenLimit('Hello world', 1000);
      expect(result).toBeTruthy();
    });

    it('should return false when text exceeds limit', () => {
      const longText = 'word '.repeat(1000);
      const result = checkTokenLimit(longText, 10);
      expect(result).toBeFalsy();
    });
  });

  describe('countTotalTokens', () => {
    it('should count tokens for multiple texts', () => {
      const texts = ['Hello', 'world', 'test'];
      const result = countTotalTokens(texts);
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should return 0 for empty array', () => {
      const result = countTotalTokens([]);
      expect(result).toBe(0);
    });

    it('should sum tokens correctly', () => {
      const texts = ['Hello', 'world'];
      const total = countTotalTokens(texts);
      const individual = countTokens('Hello') + countTokens('world');
      expect(total).toBe(individual);
    });
  });

  describe('formatTokenCount', () => {
    it('should format small numbers without separators', () => {
      expect(formatTokenCount(123)).toBe('123');
    });

    it('should format large numbers with thousand separators', () => {
      const formatted = formatTokenCount(1234567);
      expect(formatted).toContain(',');
    });

    it('should handle zero', () => {
      expect(formatTokenCount(0)).toBe('0');
    });
  });

  describe('calculateTokenPercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateTokenPercentage(50, 100)).toBe(50);
      expect(calculateTokenPercentage(25, 100)).toBe(25);
      expect(calculateTokenPercentage(100, 100)).toBe(100);
    });

    it('should cap at 100%', () => {
      expect(calculateTokenPercentage(150, 100)).toBe(100);
    });

    it('should return 0 when limit is 0', () => {
      expect(calculateTokenPercentage(50, 0)).toBe(0);
    });

    it('should handle decimal results', () => {
      expect(calculateTokenPercentage(33, 100)).toBe(33);
    });
  });

  describe('getTokenLimitColor', () => {
    it('should return green for low usage', () => {
      expect(getTokenLimitColor(10)).toBe('#44ff44');
      expect(getTokenLimitColor(49)).toBe('#44ff44');
    });

    it('should return yellow for medium usage', () => {
      expect(getTokenLimitColor(50)).toBe('#ffdd00');
      expect(getTokenLimitColor(74)).toBe('#ffdd00');
    });

    it('should return orange for high usage', () => {
      expect(getTokenLimitColor(75)).toBe('#ffaa00');
      expect(getTokenLimitColor(89)).toBe('#ffaa00');
    });

    it('should return red for very high usage', () => {
      expect(getTokenLimitColor(90)).toBe('#ff4444');
      expect(getTokenLimitColor(100)).toBe('#ff4444');
    });
  });

  describe('TOKEN_LIMITS', () => {
    it('should have correct token limits for models', () => {
      expect(TOKEN_LIMITS['gpt-4o']).toBe(128000);
      expect(TOKEN_LIMITS['gpt-4o-mini']).toBe(128000);
      expect(TOKEN_LIMITS['gpt-4-turbo']).toBe(128000);
      expect(TOKEN_LIMITS['gpt-4']).toBe(8192);
      expect(TOKEN_LIMITS['gpt-3.5-turbo']).toBe(16385);
      expect(TOKEN_LIMITS['claude-3-opus']).toBe(200000);
      expect(TOKEN_LIMITS['claude-3-sonnet']).toBe(200000);
      expect(TOKEN_LIMITS['claude-3-haiku']).toBe(200000);
      expect(TOKEN_LIMITS['gemini-pro']).toBe(32768);
      expect(TOKEN_LIMITS['custom']).toBe(0);
    });

    it('should have all expected model keys', () => {
      const expectedKeys = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
        'gemini-pro',
        'custom',
      ];

      expectedKeys.forEach(key => {
        expect(TOKEN_LIMITS).toHaveProperty(key);
      });
    });
  });
});
