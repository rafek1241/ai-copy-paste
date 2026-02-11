#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { validateVersions } from './version-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('\x1b[34mVersion Sync Check\x1b[0m');
console.log('\x1b[90m─'.repeat(40) + '\x1b[0m');

const validation = validateVersions(PROJECT_ROOT);

if (validation.valid) {
  console.log('\x1b[32m✓ All versions are in sync\x1b[0m');
  console.log(`  Version: ${validation.versions.package}`);
  process.exit(0);
} else {
  console.error('\x1b[31m✗ Version mismatch detected!\x1b[0m');
  console.error();
  if (validation.message) {
    console.error(validation.message);
  }
  console.error();
  console.error('\x1b[33mFix this by running: npm run version:bump <version>\x1b[0m');
  process.exit(1);
}
