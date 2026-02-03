import { describe, it, expect } from 'vitest';
import {
  countTokens,
  countTotalTokens,
  formatTokenCount,
  calculateTokenPercentage,
  getTokenLimitColor,
  TOKEN_LIMITS,
} from '@/services/tokenizer';

describe('tokenizer', () => {
  describe('countTokens', () => {
    it('should count tokens correctly for simple text', () => {
      const text = 'Hello, world!';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should return 0 for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should count tokens for longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
      const count = countTokens(text);
      expect(count).toBeGreaterThan(50);
    });
  });

  describe('countTotalTokens', () => {
    it('should sum tokens from multiple texts', () => {
      const texts = ['Hello', 'world', 'test'];
      const total = countTotalTokens(texts);
      expect(total).toBeGreaterThan(0);
      expect(total).toBe(
        countTokens('Hello') + countTokens('world') + countTokens('test')
      );
    });

    it('should return 0 for empty array', () => {
      expect(countTotalTokens([])).toBe(0);
    });
  });

  describe('formatTokenCount', () => {
    it('should format numbers with thousands separator', () => {
      expect(formatTokenCount(1000).replace(/\u00A0/g, ' ')).toMatch(/1,000|1 000|1000/);
      expect(formatTokenCount(1234567).replace(/\u00A0/g, ' ')).toMatch(/1,234,567|1 234 567|1234567/); // Locale-dependent
    });

    it('should handle small numbers', () => {
      expect(formatTokenCount(42)).toBe('42');
    });
  });

  describe('calculateTokenPercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateTokenPercentage(50, 100)).toBe(50);
      expect(calculateTokenPercentage(75, 100)).toBe(75);
    });

    it('should cap at 100%', () => {
      expect(calculateTokenPercentage(150, 100)).toBe(100);
    });

    it('should handle zero limit', () => {
      expect(calculateTokenPercentage(50, 0)).toBe(0);
    });
  });

  describe('getTokenLimitColor', () => {
    it('should return green for low usage', () => {
      expect(getTokenLimitColor(25)).toBe('#44ff44');
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
    it('should have correct limits for GPT models', () => {
      expect(TOKEN_LIMITS['gpt-4o']).toBe(128000);
      expect(TOKEN_LIMITS['gpt-4']).toBe(8192);
    });

    it('should have correct limits for Claude models', () => {
      expect(TOKEN_LIMITS['claude-3-opus']).toBe(200000);
      expect(TOKEN_LIMITS['claude-3-sonnet']).toBe(200000);
    });

    it('should have all expected models', () => {
      const models = Object.keys(TOKEN_LIMITS);
      expect(models).toContain('gpt-4o');
      expect(models).toContain('claude-3-opus');
      expect(models).toContain('gemini-pro');
      expect(models).toContain('custom');
    });
  });
});
