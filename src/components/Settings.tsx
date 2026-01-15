import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

interface AppSettings {
  excluded_extensions: string[];
  token_limit: number;
  default_template: string;
  auto_save_history: boolean;
  cache_size_mb: number;
}

interface SettingsProps {
  onSettingsChange?: (settings: AppSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<AppSettings>({
    excluded_extensions: [],
    token_limit: 200000,
    default_template: 'agent',
    auto_save_history: true,
    cache_size_mb: 100,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newExtension, setNewExtension] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const loaded = await invoke<AppSettings>('load_settings');
      setSettings(loaded);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await invoke('save_settings', { settings });
      if (onSettingsChange) {
        onSettingsChange(settings);
      }
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await invoke<string>('export_settings');

      const filePath = await save({
        defaultPath: 'ai-context-collector-settings.json',
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, json);
        alert('Settings exported successfully');
      }
    } catch (error) {
      console.error('Failed to export settings:', error);
      alert('Failed to export settings');
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });

      if (filePath) {
        const json = await readTextFile(filePath as string);
        await invoke('import_settings', { jsonData: json });
        await loadSettings();
        alert('Settings imported successfully');
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
      alert('Failed to import settings');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await invoke('reset_settings');
      await loadSettings();
      alert('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      alert('Failed to reset settings');
    }
  };

  const addExtension = () => {
    const ext = newExtension.trim();
    if (!ext) return;

    const formattedExt = ext.startsWith('.') ? ext : `.${ext}`;

    if (settings.excluded_extensions.includes(formattedExt)) {
      alert('Extension already exists');
      return;
    }

    setSettings(prev => ({
      ...prev,
      excluded_extensions: [...prev.excluded_extensions, formattedExt]
    }));
    setNewExtension('');
  };

  const removeExtension = (ext: string) => {
    setSettings(prev => ({
      ...prev,
      excluded_extensions: prev.excluded_extensions.filter(e => e !== ext)
    }));
  };

  if (loading) {
    return <div className="settings-panel loading">Loading settings...</div>;
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Settings</h3>
        <div className="settings-header-actions">
          <button onClick={handleExport} className="btn-export">
            Export
          </button>
          <button onClick={handleImport} className="btn-import">
            Import
          </button>
          <button onClick={handleReset} className="btn-reset">
            Reset to Defaults
          </button>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h4>Excluded File Extensions</h4>
          <p className="settings-description">
            Files with these extensions will be skipped during indexing
          </p>

          <div className="extension-input-group">
            <input
              type="text"
              value={newExtension}
              onChange={(e) => setNewExtension(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addExtension()}
              placeholder="e.g., .exe or exe"
              className="extension-input"
            />
            <button onClick={addExtension} className="btn-add-extension">
              Add
            </button>
          </div>

          <div className="extension-list">
            {settings.excluded_extensions.map((ext) => (
              <div key={ext} className="extension-tag">
                <span>{ext}</span>
                <button
                  onClick={() => removeExtension(ext)}
                  className="btn-remove-extension"
                  title="Remove extension"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h4>Token Limit</h4>
          <p className="settings-description">
            Maximum number of tokens to include in a prompt
          </p>
          <input
            type="number"
            value={settings.token_limit}
            onChange={(e) => setSettings(prev => ({ ...prev, token_limit: parseInt(e.target.value) || 0 }))}
            min="1000"
            max="1000000"
            step="1000"
            className="token-limit-input"
          />
        </div>

        <div className="settings-section">
          <h4>Default Template</h4>
          <p className="settings-description">
            Template to use by default when building prompts
          </p>
          <select
            value={settings.default_template}
            onChange={(e) => setSettings(prev => ({ ...prev, default_template: e.target.value }))}
            className="template-select"
          >
            <option value="agent">Agent</option>
            <option value="planning">Planning</option>
            <option value="debugging">Debugging</option>
            <option value="review">Code Review</option>
          </select>
        </div>

        <div className="settings-section">
          <h4>Cache Size (MB)</h4>
          <p className="settings-description">
            Maximum size of the text extraction cache
          </p>
          <input
            type="number"
            value={settings.cache_size_mb}
            onChange={(e) => setSettings(prev => ({ ...prev, cache_size_mb: parseInt(e.target.value) || 0 }))}
            min="10"
            max="1000"
            step="10"
            className="cache-size-input"
          />
        </div>

        <div className="settings-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.auto_save_history}
              onChange={(e) => setSettings(prev => ({ ...prev, auto_save_history: e.target.checked }))}
            />
            <span>Automatically save session history</span>
          </label>
          <p className="settings-description">
            When enabled, your file selections will be automatically saved to history
          </p>
        </div>
      </div>

      <div className="settings-footer">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-save-settings"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
