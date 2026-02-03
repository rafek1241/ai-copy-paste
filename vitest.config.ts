import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/ui/setup.ts',
    include: ['tests/ui/**/*.test.{ts,tsx}'],
    api: {
      port: 51700,
      host: '127.0.0.1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/e2e/**',
        'tests/backend/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
    exclude: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      '.idea/**',
      '.git/**',
      '.cache/**',
      'tests/e2e/**',
      'tests/backend/**',
      'e2e/**',
    ],
  },
});
