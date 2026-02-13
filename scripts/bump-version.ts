#!/usr/bin/env node
import { program } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getVersions,
  validateVersions,
  setVersions,
  isValidVersion,
} from './version-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function log(message: string): void {
  console.log(message);
}

function logError(message: string): void {
  console.error(`\x1b[31m${message}\x1b[0m`);
}

function logSuccess(message: string): void {
  console.log(`\x1b[32m${message}\x1b[0m`);
}

function logInfo(message: string): void {
  console.log(`\x1b[36m${message}\x1b[0m`);
}

function logDim(message: string): void {
  console.log(`\x1b[90m${message}\x1b[0m`);
}

async function promptVersion(): Promise<string> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  return new Promise((resolve) => {
    rl.question('\x1b[36mEnter new version (e.g., 1.0.0): \x1b[0m', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptAction(): Promise<{ commit: boolean; tag: boolean; push: boolean }> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  return new Promise((resolve) => {
    rl.question('\x1b[36mChoose action: (1) Skip all, (2) Commit only, (3) Commit + Tag, (4) Commit + Tag + Push: \x1b[0m', (answer) => {
      rl.close();
      const choice = answer.trim();
      resolve({
        commit: choice !== '1',
        tag: choice === '3' || choice === '4',
        push: choice === '4',
      });
    });
  });
}

async function runBump(version: string, options: { tag: boolean; commit: boolean; push: boolean; dryRun: boolean }) {
  const normalizedVersion = version.startsWith('v') ? version.slice(1) : version;

  if (!isValidVersion(normalizedVersion)) {
    logError(`Invalid version format: ${version}`);
    logDim('Expected format: X.Y.Z or vX.Y.Z (e.g., 1.0.0 or v1.0.0)');
    process.exit(1);
  }

  log('\x1b[34mVersion Bump\x1b[0m');
  logDim('─'.repeat(40));

  const currentVersions = getVersions(PROJECT_ROOT);
  logInfo('Current versions:');
  console.log(`  package.json:    ${currentVersions.package}`);
  console.log(`  Cargo.toml:      ${currentVersions.cargo}`);
  console.log(`  tauri.conf.json: ${currentVersions.tauri}`);
  console.log();

  const validation = validateVersions(PROJECT_ROOT);
  if (!validation.valid) {
    console.log('\x1b[33m⚠️  Warning: Current versions are not in sync\x1b[0m');
    if (validation.message) {
      logDim(validation.message);
    }
    console.log();
  }

  logInfo('New version:');
  logSuccess(`  ${normalizedVersion}`);
  console.log();

  if (options.dryRun) {
    logDim('Dry run - no changes will be made');
    logDim('─'.repeat(40));
    
    console.log('Would update:');
    console.log(`  \x1b[90mpackage.json\x1b[0m → ${normalizedVersion}`);
    console.log(`  \x1b[90mpackage-lock.json\x1b[0m → (updated via npm install)`);
    console.log(`  \x1b[90msrc-tauri/Cargo.toml\x1b[0m → ${normalizedVersion}`);
    console.log(`  \x1b[90msrc-tauri/Cargo.lock\x1b[0m → (updated via cargo check)`);
    console.log(`  \x1b[90msrc-tauri/tauri.conf.json\x1b[0m → ${normalizedVersion}`);
    
    if (options.commit) {
      console.log(`\nWould commit with message: \x1b[90mchore: bump version to ${normalizedVersion}\x1b[0m`);
    }
    
    if (options.tag) {
      console.log(`Would create tag: \x1b[90mv${normalizedVersion}\x1b[0m`);
    }
    
    if (options.push) {
      console.log('Would push commit and tag to remote');
    }
    
    process.exit(0);
  }

  logInfo('Updating versions...');
  try {
    setVersions(PROJECT_ROOT, normalizedVersion);
    logSuccess('✓ Versions updated successfully');
  } catch (error) {
    logError('Failed to update versions');
    console.error(error);
    process.exit(1);
  }

  logInfo('Running npm install to update lock files...');
  try {
    execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    logSuccess('✓ npm install completed');
  } catch (error) {
    logError('Failed to run npm install');
    console.error(error);
    process.exit(1);
  }

  logInfo('Ensuring Cargo.lock is updated...');
  try {
    execSync('cargo check', { cwd: path.join(PROJECT_ROOT, 'src-tauri'), stdio: 'inherit' });
    logSuccess('✓ Cargo.lock updated');
  } catch (error) {
    logError('Failed to update Cargo.lock');
    console.error(error);
    process.exit(1);
  }

  const newValidation = validateVersions(PROJECT_ROOT);
  if (!newValidation.valid) {
    logError('Version sync failed after update!');
    if (newValidation.message) {
      console.error(newValidation.message);
    }
    process.exit(1);
  }

  if (options.commit) {
    logInfo('Creating commit...');
    try {
      execSync('git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${normalizedVersion}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
      logSuccess('✓ Commit created');
    } catch (error) {
      logError('Failed to create commit');
      console.error(error);
      process.exit(1);
    }
  }

  if (options.tag) {
    logInfo('Creating git tag...');
    try {
      execSync(`git tag -a v${normalizedVersion} -m "Release v${normalizedVersion}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
      logSuccess(`✓ Tag v${normalizedVersion} created`);
    } catch (error) {
      logError('Failed to create tag');
      console.error(error);
      process.exit(1);
    }
  }

  if (options.push) {
    logInfo('Pushing to remote...');
    try {
      if (options.commit) {
        execSync('git push', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      }
      if (options.tag) {
        execSync(`git push origin v${normalizedVersion}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
      }
      logSuccess('✓ Pushed to remote');
    } catch (error) {
      logError('Failed to push');
      console.error(error);
      process.exit(1);
    }
  }

  console.log();
  logSuccess('✅ Version bump complete!');
  console.log();
  logDim('Next steps:');
  if (!options.commit) {
    logDim('  1. Review the changes');
    logDim('  2. Commit: git add . && git commit -m "chore: bump version"');
  }
  if (!options.tag) {
    logDim(`  3. Tag: git tag -a v${normalizedVersion} -m "Release v${normalizedVersion}"`);
  }
  if (!options.push) {
    logDim('  4. Push: git push && git push --tags');
  }
  logDim('  5. The release workflow will automatically build installers');
}

program
  .name('bump-version')
  .description('Bump version across package.json, Cargo.toml, and tauri.conf.json')
  .argument('[version]', 'New version number (e.g., 1.0.0 or v1.0.0)')
  .option('-t, --tag', 'Create a git tag for the version', false)
  .option('-c, --commit', 'Commit the version changes', false)
  .option('-p, --push', 'Push the commit and tag to remote', false)
  .option('--dry-run', 'Show what would be changed without making changes', false)
  .action(async (version: string | undefined, options: { tag: boolean; commit: boolean; push: boolean; dryRun: boolean }) => {
    if (!version) {
      version = await promptVersion();
      const action = await promptAction();
      options.commit = action.commit;
      options.tag = action.tag;
      options.push = action.push;
    }
    await runBump(version, options);
  });

program.parse();
