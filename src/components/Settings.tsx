import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { cn } from '@/lib/utils';

interface AppSettings {
  excluded_extensions: string[];
  token_limit: number;
  default_template: string;
  auto_save_history: boolean;
  cache_size_mb: number;
  respect_gitignore: boolean;
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
    respect_gitignore: true,
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
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-white/40">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        <span className="text-[11px] font-medium uppercase tracking-widest">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] h-full overflow-y-auto custom-scrollbar" data-testid="settings-view">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">settings</span>
            Application Settings
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-white transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">upload</span>
              EXPORT
            </button>
            <button
              onClick={handleImport}
              className="px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-white transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              IMPORT
            </button>
            <button
              onClick={handleReset}
              className="px-3 h-7 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-[10px] font-bold text-red-500 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
              RESET
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Files section */}
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Excluded Extensions:
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newExtension}
                  onChange={(e) => setNewExtension(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addExtension()}
                  placeholder="e.g. .exe"
                  className="flex-1 h-8 px-3 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={addExtension}
                  className="px-3 h-8 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded transition-colors"
                >
                  ADD
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-black/20 rounded-md border border-white/5">
                {settings.excluded_extensions.length === 0 && (
                  <span className="text-[10px] text-white/20 italic p-1">No exclusions.</span>
                )}
                {settings.excluded_extensions.map((ext) => (
                  <div key={ext} className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 group hover:border-white/20 transition-colors">
                    <span>{ext}</span>
                    <button
                      onClick={() => removeExtension(ext)}
                      className="size-4 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-md">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={settings.respect_gitignore}
                    onChange={(e) => setSettings(prev => ({ ...prev, respect_gitignore: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="size-4 border border-white/20 rounded bg-black/40 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-[12px] text-white scale-0 peer-checked:scale-100 transition-transform">check</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">Respect .gitignore Rules</div>
                  <div className="text-[9px] text-white/30 leading-relaxed">Automatically exclude files matching .gitignore patterns during indexing.</div>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider text-green-400/80">
                Cache Management:
              </label>
              <div className="p-4 bg-white/5 border border-white/10 rounded-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-white">Cache Size Limit</div>
                    <div className="text-[9px] text-white/30">Max extraction storage (MB)</div>
                  </div>
                  <input
                    type="number"
                    value={settings.cache_size_mb}
                    onChange={(e) => setSettings(prev => ({ ...prev, cache_size_mb: parseInt(e.target.value) || 0 }))}
                    className="w-20 h-7 px-2 bg-black/40 border border-white/10 rounded text-[11px] text-white text-right focus:outline-none focus:border-primary/50"
                    min="10" max="1000" step="10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Prompt section */}
          <div className="space-y-6">
            <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-md">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-white">Token Warning Limit</div>
                  <div className="text-[9px] text-white/30">Alert when context exceeds this limit</div>
                </div>
                <input
                  type="number"
                  value={settings.token_limit}
                  onChange={(e) => setSettings(prev => ({ ...prev, token_limit: parseInt(e.target.value) || 0 }))}
                  className="w-24 h-7 px-2 bg-black/40 border border-white/10 rounded text-[11px] text-white text-right focus:outline-none focus:border-primary/50"
                  min="1000" max="1000000" step="1000"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-white">Default AI Template</div>
                  <div className="text-[9px] text-white/30">Standard instruction for prompts</div>
                </div>
                <div className="relative">
                  <select
                    value={settings.default_template}
                    onChange={(e) => setSettings(prev => ({ ...prev, default_template: e.target.value }))}
                    className="w-32 h-7 pl-2 pr-6 bg-black/40 border border-white/10 rounded text-[11px] text-white appearance-none focus:outline-none focus:border-primary/50"
                  >
                    <option value="agent">Agent</option>
                    <option value="planning">Planning</option>
                    <option value="debugging">Debugging</option>
                    <option value="review">Review</option>
                  </select>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-white/20 pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-md">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={settings.auto_save_history}
                    onChange={(e) => setSettings(prev => ({ ...prev, auto_save_history: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="size-4 border border-white/20 rounded bg-black/40 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-[12px] text-white scale-0 peer-checked:scale-100 transition-transform">check</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">Auto-save History</div>
                  <div className="text-[9px] text-white/30 leading-relaxed">Persist file selections to history automatically on building prompt.</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-white/5">
          <button
            onClick={saveSettings}
            disabled={saving}
            className={cn(
              "w-full h-10 rounded font-bold text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2",
              saving ? "bg-white/5 text-white/20 cursor-wait" : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 active:scale-[0.99]"
            )}
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">save</span>
            )}
            {saving ? 'SAVING...' : 'SAVE CONFIGURATION'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
