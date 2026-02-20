#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { validateVersions } from './version-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

function color(code: string, text: string): string {
  if (!supportsColor) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function run(): number {
  try {
    console.log(color('34', 'Version Sync Check'));
    console.log(color('90', '-'.repeat(40)));

    const validation = validateVersions(PROJECT_ROOT);

    if (validation.valid) {
      console.log(color('32', 'OK: All versions are in sync'));
      console.log(`  Version: ${validation.versions.package}`);
      return 0;
    }

    console.error(color('31', 'ERROR: Version mismatch detected'));
    console.error();
    if (validation.message) {
      console.error(validation.message);
    }
    console.error();
    console.error(color('33', 'Fix this by running: npm run version:bump <version>'));
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(color('31', `ERROR: Failed to validate versions: ${message}`));
    return 1;
  }
}

process.exit(run());
