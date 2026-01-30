import { describe, it, expect } from 'vitest';
import type { FileEntry, IndexProgress } from '@/types';

describe('types', () => {
  describe('FileEntry', () => {
    it('should have correct structure with path as primary key', () => {
      const entry: FileEntry = {
        path: '/test/test.txt',
        parent_path: '/test',
        name: 'test.txt',
        size: 1024,
        mtime: Date.now(),
        is_dir: false,
        token_count: null,
        fingerprint: 'abc123',
        child_count: null,
      };

      expect(entry.path).toBe('/test/test.txt');
      expect(entry.is_dir).toBe(false);
      expect(entry.parent_path).toBe('/test');
      expect(entry.token_count).toBeNull();
    });

    it('should support directory entries', () => {
      const dirEntry: FileEntry = {
        path: '/test/folder',
        parent_path: '/test',
        name: 'folder',
        size: null,
        mtime: Date.now(),
        is_dir: true,
        token_count: null,
        fingerprint: null,
        child_count: 5,
      };

      expect(dirEntry.is_dir).toBe(true);
      expect(dirEntry.size).toBeNull();
      expect(dirEntry.child_count).toBe(5);
    });

    it('should support root-level entries with null parent_path', () => {
      const rootEntry: FileEntry = {
        path: '/test',
        parent_path: null,
        name: 'test',
        size: null,
        mtime: Date.now(),
        is_dir: true,
        token_count: null,
        fingerprint: null,
        child_count: 10,
      };

      expect(rootEntry.parent_path).toBeNull();
    });
  });

  describe('IndexProgress', () => {
    it('should have correct structure', () => {
      const progress: IndexProgress = {
        processed: 100,
        total_estimate: 1000,
        current_path: '/test/path',
        errors: 5,
      };

      expect(progress.processed).toBe(100);
      expect(progress.total_estimate).toBe(1000);
      expect(progress.errors).toBe(5);
    });

    it('should handle zero errors', () => {
      const progress: IndexProgress = {
        processed: 50,
        total_estimate: 100,
        current_path: '/test',
        errors: 0,
      };

      expect(progress.errors).toBe(0);
    });
  });
});
