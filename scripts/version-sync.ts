import fs from 'fs';
import path from 'path';

export interface VersionInfo {
  package: string;
  cargo: string;
  tauri: string;
}

export interface ValidationResult {
  valid: boolean;
  versions: VersionInfo;
  message?: string;
}

/**
 * Get version from package.json
 */
export function getPackageVersion(projectRoot: string): string {
  const packagePath = path.join(projectRoot, 'package.json');
  const content = fs.readFileSync(packagePath, 'utf-8');
  const pkg = JSON.parse(content);
  return pkg.version;
}

/**
 * Set version in package.json
 */
export function setPackageVersion(projectRoot: string, version: string): void {
  const packagePath = path.join(projectRoot, 'package.json');
  const content = fs.readFileSync(packagePath, 'utf-8');
  const pkg = JSON.parse(content);
  pkg.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Get version from Cargo.toml
 */
export function getCargoVersion(projectRoot: string): string {
  const cargoPath = path.join(projectRoot, 'src-tauri', 'Cargo.toml');
  const content = fs.readFileSync(cargoPath, 'utf-8');
  const match = content.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : '';
}

/**
 * Set version in Cargo.toml
 */
export function setCargoVersion(projectRoot: string, version: string): void {
  const cargoPath = path.join(projectRoot, 'src-tauri', 'Cargo.toml');
  const content = fs.readFileSync(cargoPath, 'utf-8');
  // Update version in [package] section
  const updated = content.replace(
    /^(\[package\]\n(?:.*\n)*?)version\s*=\s*"[^"]+"/m,
    `$1version = "${version}"`
  );
  fs.writeFileSync(cargoPath, updated);
}

/**
 * Get version from tauri.conf.json
 */
export function getTauriVersion(projectRoot: string): string {
  const tauriPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  const content = fs.readFileSync(tauriPath, 'utf-8');
  const conf = JSON.parse(content);
  return conf.version;
}

/**
 * Set version in tauri.conf.json
 */
export function setTauriVersion(projectRoot: string, version: string): void {
  const tauriPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  const content = fs.readFileSync(tauriPath, 'utf-8');
  const conf = JSON.parse(content);
  conf.version = version;
  fs.writeFileSync(tauriPath, JSON.stringify(conf, null, 2) + '\n');
}

/**
 * Get all versions from the project
 */
export function getVersions(projectRoot: string): VersionInfo {
  return {
    package: getPackageVersion(projectRoot),
    cargo: getCargoVersion(projectRoot),
    tauri: getTauriVersion(projectRoot),
  };
}

/**
 * Validate that all versions match
 */
export function validateVersions(projectRoot: string): ValidationResult {
  const versions = getVersions(projectRoot);
  
  if (versions.package === versions.cargo && versions.cargo === versions.tauri) {
    return {
      valid: true,
      versions,
    };
  }
  
  return {
    valid: false,
    versions,
    message: `Version mismatch detected:
  package.json: ${versions.package}
  Cargo.toml:   ${versions.cargo}
  tauri.conf:   ${versions.tauri}

All versions must match. Use 'npm run version:bump <version>' to sync them.`,
  };
}

/**
 * Set version in all files
 */
export function setVersions(projectRoot: string, version: string): void {
  setPackageVersion(projectRoot, version);
  setCargoVersion(projectRoot, version);
  setTauriVersion(projectRoot, version);
}

/**
 * Validate version format (semver)
 */
export function isValidVersion(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;
  return semverRegex.test(version);
}
