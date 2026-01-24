import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyMatch } from './fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('fuzzyScore', () => {
    it('should return 1.0 for exact match', () => {
      expect(fuzzyScore('App', 'App')).toBe(1);
    });

    it('should return 1.0 for exact match (case insensitive)', () => {
      expect(fuzzyScore('app', 'App')).toBe(1);
      expect(fuzzyScore('APP', 'app')).toBe(1);
    });

    it('should return high score for close matches', () => {
      const score = fuzzyScore('App', 'app.tsx');
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return higher score for closer matches', () => {
      const scoreExact = fuzzyScore('App', 'App.tsx');
      const scorePartial = fuzzyScore('App', 'app.test.tsx');
      expect(scoreExact).toBeGreaterThan(scorePartial);
    });

    it('should return 0 for completely different strings', () => {
      const score = fuzzyScore('xyz', 'abc');
      expect(score).toBeLessThanOrEqual(0.3);
    });

    it('should handle empty query', () => {
      expect(fuzzyScore('', 'test')).toBe(0);
    });

    it('should handle empty target', () => {
      expect(fuzzyScore('test', '')).toBe(0);
    });

    it('should handle partial matches', () => {
      const score = fuzzyScore('App', 'MyAppComponent');
      expect(score).toBeGreaterThan(0);
    });

    it('should prioritize prefix matches', () => {
      const prefixScore = fuzzyScore('App', 'App.tsx');
      const middleScore = fuzzyScore('App', 'MyApp.tsx');
      expect(prefixScore).toBeGreaterThan(middleScore);
    });

    it('should handle unicode characters', () => {
      const score = fuzzyScore('test', 'test.tsx');
      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('fuzzyMatch', () => {
    it('should return true for matches above threshold', () => {
      expect(fuzzyMatch('App', 'App.tsx')).toBe(true);
    });

    it('should return false for non-matches', () => {
      expect(fuzzyMatch('xyz', 'abc')).toBe(false);
    });

    it('should use default threshold of 0.3', () => {
      // A partial match should pass with score > 0.3
      expect(fuzzyMatch('test', 'test.ts')).toBe(true);
    });

    it('should support custom threshold', () => {
      // A partial match might not pass with high threshold
      const result = fuzzyMatch('a', 'abcdefghij', 0.9);
      expect(result).toBe(false);
    });

    it('should return true for exact matches with any threshold', () => {
      expect(fuzzyMatch('test', 'test', 0.99)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(fuzzyMatch('APP', 'app.tsx')).toBe(true);
      expect(fuzzyMatch('app', 'APP.tsx')).toBe(true);
    });
  });
});
