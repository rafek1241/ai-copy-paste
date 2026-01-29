import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { cn } from '@/lib/utils';
import { useToast } from './ui/toast';
import { useConfirmDialog } from './ui/alert-dialog';
import { useAppSettings } from '@/contexts/AppContext';

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

  const { success, error: showError, warning } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { updateSettings: updateGlobalSettings } = useAppSettings();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await invoke<AppSettings>('load_settings');
      if (loaded && typeof loaded === 'object') {
        setSettings(prev => ({
          ...prev,
          ...loaded,
          excluded_extensions: loaded.excluded_extensions || [],
        }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      await invoke('save_settings', { settings });

      // Update global context
      updateGlobalSettings({
        tokenLimit: settings.token_limit,
        defaultTemplate: settings.default_template,
        autoSaveHistory: settings.auto_save_history,
      });

      if (onSettingsChange) {
        onSettingsChange(settings);
      }
      success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings, onSettingsChange, success, showError, updateGlobalSettings]);

  const handleExport = useCallback(async () => {
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
        success('Settings exported successfully');
      }
    } catch (error) {
      console.error('Failed to export settings:', error);
      showError('Failed to export settings');
    }
  }, [success, showError]);

  const handleImport = useCallback(async () => {
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
        success('Settings imported successfully');
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
      showError('Failed to import settings');
    }
  }, [loadSettings, success, showError]);

  const handleReset = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Reset Settings',
      description: 'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await invoke('reset_settings');
      await loadSettings();
      success('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showError('Failed to reset settings');
    }
  }, [confirm, loadSettings, success, showError]);

  const addExtension = useCallback(() => {
    const ext = newExtension.trim();
    if (!ext) return;

    const formattedExt = ext.startsWith('.') ? ext : `.${ext}`;

    if (settings.excluded_extensions.includes(formattedExt)) {
      warning('Extension already exists');
      return;
    }

    setSettings(prev => ({
      ...prev,
      excluded_extensions: [...prev.excluded_extensions, formattedExt]
    }));
    setNewExtension('');
  }, [newExtension, settings.excluded_extensions, warning]);

  const removeExtension = useCallback((ext: string) => {
    setSettings(prev => ({
      ...prev,
      excluded_extensions: prev.excluded_extensions.filter(e => e !== ext)
    }));
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addExtension();
    }
  }, [addExtension]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-white/40" role="status">
        <span className="material-symbols-outlined animate-spin mr-2" aria-hidden="true">progress_activity</span>
        <span className="text-[11px] font-medium uppercase tracking-widest">Loading Settings...</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex-1 flex flex-col bg-[#0d1117] h-full overflow-y-auto custom-scrollbar"
        data-testid="settings-view"
        role="region"
        aria-label="Application settings"
      >
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">settings</span>
              Application Settings
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-white transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-white/30"
                aria-label="Export settings"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">upload</span>
                EXPORT
              </button>
              <button
                onClick={handleImport}
                className="px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-white transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-white/30"
                aria-label="Import settings"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">download</span>
                IMPORT
              </button>
              <button
                onClick={handleReset}
                className="px-3 h-7 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-[10px] font-bold text-red-500 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                aria-label="Reset settings to defaults"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">restart_alt</span>
                RESET
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Files section */}
            <section className="space-y-4" aria-labelledby="files-section-heading">
              <div className="space-y-3">
                <label
                  htmlFor="new-extension"
                  className="block text-[10px] font-bold text-white/50 uppercase tracking-wider"
                  id="files-section-heading"
                >
                  Excluded Extensions:
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="new-extension"
                    type="text"
                    value={newExtension}
                    onChange={(e) => setNewExtension(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g. .exe"
                    className="flex-1 h-8 px-3 bg-white/5 border border-white/10 rounded text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                    aria-describedby="extension-help"
                  />
                  <button
                    onClick={addExtension}
                    className="px-3 h-8 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    ADD
                  </button>
                </div>
                <div
                  className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-black/20 rounded-md border border-white/5"
                  role="list"
                  aria-label="Excluded extensions"
                >
                  {settings.excluded_extensions.length === 0 && (
                    <span className="text-[10px] text-white/20 italic p-1">No exclusions.</span>
                  )}
                  {settings.excluded_extensions.map((ext) => (
                    <div
                      key={ext}
                      role="listitem"
                      className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/70 group hover:border-white/20 transition-colors"
                    >
                      <span>{ext}</span>
                      <button
                        onClick={() => removeExtension(ext)}
                        className="size-4 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors focus:outline-none focus:text-red-400"
                        aria-label={`Remove ${ext}`}
                      >
                        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="block text-[10px] font-bold text-white/50 uppercase tracking-wider text-green-400/80">
                  Cache Management:
                </h3>
                <div className="p-4 bg-white/5 border border-white/10 rounded-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label htmlFor="cache-size" className="text-[11px] font-bold text-white">Cache Size Limit</label>
                      <div className="text-[9px] text-white/30">Max extraction storage (MB)</div>
                    </div>
                    <input
                      id="cache-size"
                      type="number"
                      value={settings.cache_size_mb}
                      onChange={(e) => setSettings(prev => ({ ...prev, cache_size_mb: parseInt(e.target.value) || 0 }))}
                      className="w-20 h-7 px-2 bg-black/40 border border-white/10 rounded text-[11px] text-white text-right focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      min="10"
                      max="1000"
                      step="10"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Prompt section */}
            <section className="space-y-6" aria-labelledby="prompt-section-heading">
              <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="token-limit" className="text-[11px] font-bold text-white">Token Warning Limit</label>
                    <div className="text-[9px] text-white/30">Alert when context exceeds this limit</div>
                  </div>
                  <input
                    id="token-limit"
                    type="number"
                    value={settings.token_limit}
                    onChange={(e) => setSettings(prev => ({ ...prev, token_limit: parseInt(e.target.value) || 0 }))}
                    className="w-24 h-7 px-2 bg-black/40 border border-white/10 rounded text-[11px] text-white text-right focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    min="1000"
                    max="1000000"
                    step="1000"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="default-template" className="text-[11px] font-bold text-white">Default AI Template</label>
                    <div className="text-[9px] text-white/30">Standard instruction for prompts</div>
                  </div>
                  <div className="relative">
                    <select
                      id="default-template"
                      value={settings.default_template}
                      onChange={(e) => setSettings(prev => ({ ...prev, default_template: e.target.value }))}
                      className="w-32 h-7 pl-2 pr-6 bg-black/40 border border-white/10 rounded text-[11px] text-white appearance-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="agent">Agent</option>
                      <option value="planning">Planning</option>
                      <option value="debugging">Debugging</option>
                      <option value="review">Review</option>
                    </select>
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-white/20 pointer-events-none" aria-hidden="true">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-md">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="pt-0.5 relative">
                    <input
                      type="checkbox"
                      checked={settings.auto_save_history}
                      onChange={(e) => setSettings(prev => ({ ...prev, auto_save_history: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="size-4 border border-white/20 rounded bg-black/40 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center peer-focus:ring-1 peer-focus:ring-primary/50">
                      <span className="material-symbols-outlined text-[12px] text-white scale-0 peer-checked:scale-100 transition-transform" aria-hidden="true">check</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">Auto-save History</div>
                    <div className="text-[9px] text-white/30 leading-relaxed">Persist file selections to history automatically on building prompt.</div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          <div className="pt-4 mt-4 border-t border-white/5">
            <button
              onClick={saveSettings}
              disabled={saving}
              className={cn(
                "w-full h-10 rounded font-bold text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary/50",
                saving ? "bg-white/5 text-white/20 cursor-wait" : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 active:scale-[0.99]"
              )}
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-[16px]" aria-hidden="true">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">save</span>
              )}
              {saving ? 'SAVING...' : 'SAVE CONFIGURATION'}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog />
    </>
  );
};

export default Settings;
