import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getPackageVersion,
  getCargoVersion,
  getTauriVersion,
  getVersions,
  validateVersions,
  setPackageVersion,
  setCargoVersion,
  setTauriVersion,
  setVersions,
  isValidVersion,
} from './version-sync';

describe('Version Sync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getPackageVersion', () => {
    it('should read version from package.json', () => {
      const packageJson = {
        name: 'test-package',
        version: '1.2.3',
      };
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(packageJson));

      const version = getPackageVersion(tmpDir);
      expect(version).toBe('1.2.3');
    });
  });

  describe('getCargoVersion', () => {
    it('should read version from Cargo.toml', () => {
      const cargoContent = `[package]
name = "test"
version = "2.0.0"
edition = "2021"`;
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src-tauri', 'Cargo.toml'), cargoContent);

      const version = getCargoVersion(tmpDir);
      expect(version).toBe('2.0.0');
    });
  });

  describe('getTauriVersion', () => {
    it('should read version from tauri.conf.json', () => {
      const tauriConf = {
        productName: 'test',
        version: '3.0.0',
        identifier: 'com.test.app',
      };
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src-tauri', 'tauri.conf.json'), JSON.stringify(tauriConf));

      const version = getTauriVersion(tmpDir);
      expect(version).toBe('3.0.0');
    });
  });

  describe('getVersions', () => {
    it('should return all versions', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'Cargo.toml'),
        `[package]\nversion = "1.0.0"`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'tauri.conf.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      const versions = getVersions(tmpDir);
      expect(versions).toEqual({
        package: '1.0.0',
        cargo: '1.0.0',
        tauri: '1.0.0',
      });
    });
  });

  describe('validateVersions', () => {
    it('should return valid when all versions match', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'Cargo.toml'),
        `[package]\nversion = "1.0.0"`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'tauri.conf.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      const result = validateVersions(tmpDir);
      expect(result.valid).toBe(true);
      expect(result.versions).toEqual({
        package: '1.0.0',
        cargo: '1.0.0',
        tauri: '1.0.0',
      });
    });

    it('should return invalid when versions do not match', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'Cargo.toml'),
        `[package]\nversion = "1.0.1"`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'tauri.conf.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      const result = validateVersions(tmpDir);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Version mismatch');
    });
  });

  describe('setPackageVersion', () => {
    it('should update version in package.json', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '0.1.0' }, null, 2)
      );

      setPackageVersion(tmpDir, '2.0.0');

      const updated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      expect(updated.version).toBe('2.0.0');
    });
  });

  describe('setCargoVersion', () => {
    it('should update version in Cargo.toml', () => {
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'Cargo.toml'),
        `[package]\nname = "test"\nversion = "0.1.0"`
      );

      setCargoVersion(tmpDir, '2.0.0');

      const content = fs.readFileSync(path.join(tmpDir, 'src-tauri', 'Cargo.toml'), 'utf-8');
      expect(content).toContain('version = "2.0.0"');
    });
  });

  describe('setTauriVersion', () => {
    it('should update version in tauri.conf.json', () => {
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'tauri.conf.json'),
        JSON.stringify({ version: '0.1.0' }, null, 2)
      );

      setTauriVersion(tmpDir, '2.0.0');

      const updated = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'src-tauri', 'tauri.conf.json'), 'utf-8')
      );
      expect(updated.version).toBe('2.0.0');
    });
  });

  describe('setVersions', () => {
    it('should update version in all files', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ version: '0.1.0', name: 'test' }, null, 2)
      );
      fs.mkdirSync(path.join(tmpDir, 'src-tauri'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'Cargo.toml'),
        `[package]\nname = "test"\nversion = "0.1.0"`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src-tauri', 'tauri.conf.json'),
        JSON.stringify({ version: '0.1.0' }, null, 2)
      );

      setVersions(tmpDir, '2.0.0');

      const packageJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
      expect(packageJson.version).toBe('2.0.0');

      const cargoContent = fs.readFileSync(path.join(tmpDir, 'src-tauri', 'Cargo.toml'), 'utf-8');
      expect(cargoContent).toContain('version = "2.0.0"');

      const tauriConf = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'src-tauri', 'tauri.conf.json'), 'utf-8')
      );
      expect(tauriConf.version).toBe('2.0.0');
    });
  });

  describe('isValidVersion', () => {
    it('should accept valid semver versions', () => {
      expect(isValidVersion('1.0.0')).toBe(true);
      expect(isValidVersion('0.1.0')).toBe(true);
      expect(isValidVersion('10.20.30')).toBe(true);
      expect(isValidVersion('1.0.0-beta.1')).toBe(true);
      expect(isValidVersion('1.0.0-alpha')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(isValidVersion('v1.0.0')).toBe(false);
      expect(isValidVersion('1.0')).toBe(false);
      expect(isValidVersion('1')).toBe(false);
      expect(isValidVersion('abc')).toBe(false);
      expect(isValidVersion('')).toBe(false);
    });
  });
});
