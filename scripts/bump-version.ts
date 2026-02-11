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

program
  .name('bump-version')
  .description('Bump version across package.json, Cargo.toml, and tauri.conf.json')
  .argument('<version>', 'New version number (e.g., 1.0.0 or v1.0.0)')
  .option('-t, --tag', 'Create a git tag for the version', false)
  .option('-c, --commit', 'Commit the version changes', false)
  .option('-p, --push', 'Push the commit and tag to remote', false)
  .option('--dry-run', 'Show what would be changed without making changes', false)
  .action((version: string, options: { tag: boolean; commit: boolean; push: boolean; dryRun: boolean }) => {
    // Normalize version (remove 'v' prefix if present)
    const normalizedVersion = version.startsWith('v') ? version.slice(1) : version;

    // Validate version format
    if (!isValidVersion(normalizedVersion)) {
      logError(`Invalid version format: ${version}`);
      logDim('Expected format: X.Y.Z or vX.Y.Z (e.g., 1.0.0 or v1.0.0)');
      process.exit(1);
    }

    log('\x1b[34mVersion Bump\x1b[0m');
    logDim('─'.repeat(40));

    // Get current versions
    const currentVersions = getVersions(PROJECT_ROOT);
    logInfo('Current versions:');
    console.log(`  package.json:    ${currentVersions.package}`);
    console.log(`  Cargo.toml:      ${currentVersions.cargo}`);
    console.log(`  tauri.conf.json: ${currentVersions.tauri}`);
    console.log();

    // Check if current versions are in sync
    const validation = validateVersions(PROJECT_ROOT);
    if (!validation.valid) {
      console.log('\x1b[33m⚠️  Warning: Current versions are not in sync\x1b[0m');
      if (validation.message) {
        logDim(validation.message);
      }
      console.log();
    }

    // Show new version
    logInfo('New version:');
    logSuccess(`  ${normalizedVersion}`);
    console.log();

    // Dry run - just show what would happen
    if (options.dryRun) {
      logDim('Dry run - no changes will be made');
      logDim('─'.repeat(40));
      
      console.log('Would update:');
      console.log(`  \x1b[90mpackage.json\x1b[0m → ${normalizedVersion}`);
      console.log(`  \x1b[90msrc-tauri/Cargo.toml\x1b[0m → ${normalizedVersion}`);
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

    // Update versions
    logInfo('Updating versions...');
    try {
      setVersions(PROJECT_ROOT, normalizedVersion);
      logSuccess('✓ Versions updated successfully');
    } catch (error) {
      logError('Failed to update versions');
      console.error(error);
      process.exit(1);
    }

    // Verify the update
    const newValidation = validateVersions(PROJECT_ROOT);
    if (!newValidation.valid) {
      logError('Version sync failed after update!');
      if (newValidation.message) {
        console.error(newValidation.message);
      }
      process.exit(1);
    }

    // Commit changes
    if (options.commit) {
      logInfo('Creating commit...');
      try {
        execSync('git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to ${normalizedVersion}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
        logSuccess('✓ Commit created');
      } catch (error) {
        logError('Failed to create commit');
        console.error(error);
        process.exit(1);
      }
    }

    // Create tag
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

    // Push
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
  });

program.parse();
