import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Disable global Tauri API
  if (config.app) {
    config.app.withGlobalTauri = false;
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('Disabled global Tauri API (restored security settings)');
} catch (error) {
  console.error('Failed to restore E2E config:', error);
  process.exit(1);
}
