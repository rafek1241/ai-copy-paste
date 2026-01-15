import { describe, it, expect } from 'vitest';
import type { FileEntry, IndexProgress } from './types';

describe('types', () => {
  describe('FileEntry', () => {
    it('should have correct structure', () => {
      const entry: FileEntry = {
        id: 1,
        parent_id: null,
        name: 'test.txt',
        path: '/test/test.txt',
        size: 1024,
        mtime: Date.now(),
        is_dir: false,
        token_count: null,
        fingerprint: 'abc123',
      };

      expect(entry.id).toBe(1);
      expect(entry.is_dir).toBe(false);
      expect(entry.parent_id).toBeNull();
      expect(entry.token_count).toBeNull();
    });

    it('should support directory entries', () => {
      const dirEntry: FileEntry = {
        id: 2,
        parent_id: null,
        name: 'folder',
        path: '/test/folder',
        size: null,
        mtime: Date.now(),
        is_dir: true,
        token_count: null,
        fingerprint: null,
      };

      expect(dirEntry.is_dir).toBe(true);
      expect(dirEntry.size).toBeNull();
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
