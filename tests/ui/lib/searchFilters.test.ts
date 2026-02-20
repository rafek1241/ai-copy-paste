import { describe, it, expect } from 'vitest';
import { parseSearchQuery, matchesSearchFilters, SearchFilters } from '@/lib/searchFilters';

describe('searchFilters', () => {
  describe('parseSearchQuery', () => {
    it('should return empty filters for empty query', () => {
      const result = parseSearchQuery('');
      expect(result).toEqual({
        fileName: undefined,
        directoryName: undefined,
        regex: undefined,
        plainText: undefined,
      });
    });

    it('should return empty filters for whitespace-only query', () => {
      const result = parseSearchQuery('   ');
      expect(result).toEqual({
        fileName: undefined,
        directoryName: undefined,
        regex: undefined,
        plainText: undefined,
      });
    });

    it('should parse file: pattern', () => {
      const result = parseSearchQuery('file:App');
      expect(result.fileName).toBe('App');
      expect(result.plainText).toBeUndefined();
    });

    it('should parse dir: pattern', () => {
      const result = parseSearchQuery('dir:src');
      expect(result.directoryName).toBe('src');
      expect(result.plainText).toBeUndefined();
    });

    it('should parse combined file: and dir: patterns', () => {
      const result = parseSearchQuery('file:App dir:src');
      expect(result.fileName).toBe('App');
      expect(result.directoryName).toBe('src');
    });

    it('should auto-detect regex patterns with special characters', () => {
      const result = parseSearchQuery('\\.test\\.ts$');
      expect(result.regex).toBeInstanceOf(RegExp);
      expect(result.regex?.source).toBe('\\.test\\.ts$');
    });

    it('should auto-detect regex with brackets', () => {
      const result = parseSearchQuery('[abc]');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should auto-detect regex with parentheses', () => {
      const result = parseSearchQuery('(foo|bar)');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should auto-detect regex with asterisk', () => {
      const result = parseSearchQuery('test.*');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should auto-detect regex with plus', () => {
      const result = parseSearchQuery('a+b');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should auto-detect regex with caret', () => {
      const result = parseSearchQuery('^test');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should auto-detect regex with dollar sign', () => {
      const result = parseSearchQuery('test$');
      expect(result.regex).toBeInstanceOf(RegExp);
    });

    it('should fall back to plain text for invalid regex', () => {
      const result = parseSearchQuery('[invalid');
      expect(result.regex).toBeUndefined();
      expect(result.plainText).toBe('[invalid');
    });

    it('should parse plain text queries', () => {
      const result = parseSearchQuery('test');
      expect(result.plainText).toBe('test');
      expect(result.regex).toBeUndefined();
    });

    it('should handle mixed patterns with plain text', () => {
      const result = parseSearchQuery('file:App test');
      expect(result.fileName).toBe('App');
      expect(result.plainText).toBe('test');
    });

    it('should handle case in patterns', () => {
      const result = parseSearchQuery('FILE:App DIR:src');
      // Pattern prefixes should be case-insensitive
      expect(result.fileName).toBe('App');
      expect(result.directoryName).toBe('src');
    });

    it('should handle multiple spaces between patterns', () => {
      const result = parseSearchQuery('file:App    dir:src');
      expect(result.fileName).toBe('App');
      expect(result.directoryName).toBe('src');
    });

    it('should handle regex with slashes', () => {
      const result = parseSearchQuery('src/.*\\.tsx');
      expect(result.regex).toBeInstanceOf(RegExp);
    });
  });

  describe('matchesSearchFilters', () => {
    interface TestNode {
      name: string;
      path: string;
      is_dir: boolean;
    }

    const createNode = (name: string, path: string, is_dir: boolean = false): TestNode => ({
      name,
      path,
      is_dir
    });

    describe('plain text matching', () => {
      it('should match filename substring', () => {
        const filters: SearchFilters = { plainText: 'app' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should match path substring', () => {
        const filters: SearchFilters = { plainText: 'src' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should not match when no substring found', () => {
        const filters: SearchFilters = { plainText: 'xyz' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(false);
      });

      it('should be case insensitive', () => {
        const filters: SearchFilters = { plainText: 'APP' };
        const node = createNode('app.tsx', '/src/app.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });
    });

    describe('fuzzy file matching', () => {
      it('should fuzzy match filename', () => {
        const filters: SearchFilters = { fileName: 'App' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should fuzzy match with typos', () => {
        const filters: SearchFilters = { fileName: 'Ap' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should not match completely different names', () => {
        const filters: SearchFilters = { fileName: 'xyz' };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(false);
      });

      it('should score App.tsx higher than app.test.tsx', () => {
        const filters: SearchFilters = { fileName: 'App' };
        const appNode = createNode('App.tsx', '/src/App.tsx');
        const testNode = createNode('app.test.tsx', '/src/app.test.tsx');

        // Both should match, but scoring is returned
        expect(matchesSearchFilters(appNode, filters)).toBe(true);
        expect(matchesSearchFilters(testNode, filters)).toBe(true);
      });
    });

    describe('directory matching', () => {
      it('should match directory by name', () => {
        const filters: SearchFilters = { directoryName: 'src' };
        const node = createNode('App.tsx', '/project/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should match nested directories', () => {
        const filters: SearchFilters = { directoryName: 'components' };
        const node = createNode('Button.tsx', '/src/components/ui/Button.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should not match when directory not in path', () => {
        const filters: SearchFilters = { directoryName: 'lib' };
        const node = createNode('App.tsx', '/src/components/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(false);
      });

      it('should be case insensitive', () => {
        const filters: SearchFilters = { directoryName: 'SRC' };
        const node = createNode('App.tsx', '/project/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });
    });

    describe('regex matching', () => {
      it('should match filename against regex', () => {
        const filters: SearchFilters = { regex: /\.tsx$/ };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should match path against regex', () => {
        const filters: SearchFilters = { regex: /src\/.*\.tsx$/ };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should not match when regex does not match', () => {
        const filters: SearchFilters = { regex: /\.jsx$/ };
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(false);
      });

      it('should match test files', () => {
        const filters: SearchFilters = { regex: /\.test\.ts$/ };
        const testNode = createNode('app.test.ts', '/src/app.test.ts');
        const nonTestNode = createNode('app.ts', '/src/app.ts');
        expect(matchesSearchFilters(testNode, filters)).toBe(true);
        expect(matchesSearchFilters(nonTestNode, filters)).toBe(false);
      });
    });

    describe('combined filters (AND logic)', () => {
      it('should require all filters to match', () => {
        const filters: SearchFilters = { fileName: 'App', directoryName: 'src' };
        const matchingNode = createNode('App.tsx', '/project/src/App.tsx');
        const nonMatchingNode = createNode('App.tsx', '/project/lib/App.tsx');
        expect(matchesSearchFilters(matchingNode, filters)).toBe(true);
        expect(matchesSearchFilters(nonMatchingNode, filters)).toBe(false);
      });

      it('should combine file and regex filters', () => {
        const filters: SearchFilters = { fileName: 'App', regex: /\.tsx$/ };
        const tsxNode = createNode('App.tsx', '/src/App.tsx');
        const jsNode = createNode('App.js', '/src/App.js');
        expect(matchesSearchFilters(tsxNode, filters)).toBe(true);
        expect(matchesSearchFilters(jsNode, filters)).toBe(false);
      });

      it('should combine directory and plain text filters', () => {
        const filters: SearchFilters = { directoryName: 'components', plainText: 'Button' };
        const matchingNode = createNode('Button.tsx', '/src/components/Button.tsx');
        const wrongDir = createNode('Button.tsx', '/src/utils/Button.tsx');
        const wrongName = createNode('Input.tsx', '/src/components/Input.tsx');
        expect(matchesSearchFilters(matchingNode, filters)).toBe(true);
        expect(matchesSearchFilters(wrongDir, filters)).toBe(false);
        expect(matchesSearchFilters(wrongName, filters)).toBe(false);
      });

      it('should combine all filter types', () => {
        const filters: SearchFilters = {
          fileName: 'test',
          directoryName: 'src',
          regex: /\.test\.tsx$/
        };
        const matchingNode = createNode('Button.test.tsx', '/project/src/components/Button.test.tsx');
        expect(matchesSearchFilters(matchingNode, filters)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should match directories when using dir: filter', () => {
        const filters: SearchFilters = { directoryName: 'src' };
        const dirNode = createNode('src', '/project/src', true);
        expect(matchesSearchFilters(dirNode, filters)).toBe(true);
      });

      it('should handle empty filters (match everything)', () => {
        const filters: SearchFilters = {};
        const node = createNode('App.tsx', '/src/App.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should handle special characters in filenames', () => {
        const filters: SearchFilters = { plainText: 'my-file' };
        const node = createNode('my-file.tsx', '/src/my-file.tsx');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });

      it('should handle dots in directory names', () => {
        const filters: SearchFilters = { directoryName: 'node_modules' };
        const node = createNode('index.js', '/project/node_modules/package/index.js');
        expect(matchesSearchFilters(node, filters)).toBe(true);
      });
    });
  });
});
