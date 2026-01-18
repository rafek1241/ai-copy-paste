import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';

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
      if (loaded && typeof loaded === 'object') {
        setSettings({
          ...settings,
          ...loaded,
          excluded_extensions: loaded.excluded_extensions || [],
        });
      }
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
    return <div className="p-5 h-full">Loading settings...</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-foreground">Settings</h3>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="default" size="sm">
              Export
            </Button>
            <Button onClick={handleImport} variant="default" size="sm">
              Import
            </Button>
            <Button onClick={handleReset} variant="destructive" size="sm">
              Reset to Defaults
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Excluded File Extensions</CardTitle>
              <CardDescription>
                Files with these extensions will be skipped during indexing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newExtension}
                  onChange={(e) => setNewExtension(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addExtension()}
                  placeholder="e.g., .exe or exe"
                  className="flex-1"
                />
                <Button onClick={addExtension} size="sm">
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {settings.excluded_extensions.map((ext) => (
                  <div key={ext} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-xs text-foreground">
                    <span>{ext}</span>
                    <button
                      onClick={() => removeExtension(ext)}
                      className="bg-none border-none text-muted-foreground cursor-pointer text-base p-0 w-4 h-4 flex items-center justify-center hover:text-destructive"
                      title="Remove extension"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Token Limit</CardTitle>
              <CardDescription>
                Maximum number of tokens to include in a prompt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                value={settings.token_limit}
                onChange={(e) => setSettings(prev => ({ ...prev, token_limit: parseInt(e.target.value) || 0 }))}
                min="1000"
                max="1000000"
                step="1000"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Default Template</CardTitle>
              <CardDescription>
                Template to use by default when building prompts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <select
                value={settings.default_template}
                onChange={(e) => setSettings(prev => ({ ...prev, default_template: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="agent">Agent</option>
                <option value="planning">Planning</option>
                <option value="debugging">Debugging</option>
                <option value="review">Code Review</option>
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cache Size (MB)</CardTitle>
              <CardDescription>
                Maximum size of the text extraction cache
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                value={settings.cache_size_mb}
                onChange={(e) => setSettings(prev => ({ ...prev, cache_size_mb: parseInt(e.target.value) || 0 }))}
                min="10"
                max="1000"
                step="10"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={settings.auto_save_history}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_save_history: e.target.checked }))}
                  className="w-4 h-4 cursor-pointer"
                />
                <span>Automatically save session history</span>
              </label>
              <p className="text-xs text-muted-foreground mt-3">
                When enabled, your file selections will be automatically saved to history
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="w-full"
            size="lg"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};

export default Settings;
