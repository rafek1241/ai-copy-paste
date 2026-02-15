import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from './ui/toast';
import {
  Shield,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Play,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  SensitivePattern,
  getSensitivePatterns,
  getSensitiveDataEnabled,
  setSensitiveDataEnabled,
  getPreventSelection,
  setPreventSelection,
  addCustomPattern,
  deleteCustomPattern,
  togglePatternEnabled,
  validateRegexPattern,
  testPattern,
} from '@/services/sensitive';

interface SensitiveDataSettingsProps {
  onSettingsChange?: () => void;
}

const SensitiveDataSettings: React.FC<SensitiveDataSettingsProps> = ({ onSettingsChange }) => {
  const [patterns, setPatterns] = useState<SensitivePattern[]>([]);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [preventSelectionEnabled, setPreventSelectionEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPattern, setNewPattern] = useState<Partial<SensitivePattern>>({
    name: '',
    pattern: '',
    placeholder: '',
    category: 'Custom',
    enabled: true,
  });
  const [testInput, setTestInput] = useState('');
  const [testResults, setTestResults] = useState<string[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { success, error: showError } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [patternsData, enabled, prevent] = await Promise.all([
        getSensitivePatterns(),
        getSensitiveDataEnabled(),
        getPreventSelection(),
      ]);
      setPatterns(patternsData);
      setFeatureEnabled(enabled);
      setPreventSelectionEnabled(prevent);

      const categories = new Set(patternsData.map((p) => p.category));
      setExpandedCategories(categories);
    } catch (error) {
      console.error('Failed to load sensitive data settings:', error);
      showError('Failed to load sensitive data settings');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFeatureToggle = useCallback(async () => {
    try {
      const newValue = !featureEnabled;
      await setSensitiveDataEnabled(newValue);
      setFeatureEnabled(newValue);
      onSettingsChange?.();
      success(newValue ? 'Sensitive data protection enabled' : 'Sensitive data protection disabled');
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      showError('Failed to update setting');
    }
  }, [featureEnabled, onSettingsChange, success, showError]);

  const handlePreventToggle = useCallback(async () => {
    try {
      const newValue = !preventSelectionEnabled;
      await setPreventSelection(newValue);
      setPreventSelectionEnabled(newValue);
      onSettingsChange?.();
      success(newValue ? 'Prevent selection enabled' : 'Prevent selection disabled');
    } catch (error) {
      console.error('Failed to toggle prevent selection:', error);
      showError('Failed to update setting');
    }
  }, [preventSelectionEnabled, onSettingsChange, success, showError]);

  const handlePatternToggle = useCallback(
    async (patternId: string, enabled: boolean) => {
      const scrollContainer = scrollContainerRef.current;
      const scrollPosition = scrollContainer?.scrollTop ?? 0;
      
      try {
        await togglePatternEnabled(patternId, enabled);
        setPatterns((prev) =>
          prev.map((p) => (p.id === patternId ? { ...p, enabled } : p))
        );
        onSettingsChange?.();
        
        if (scrollContainer) {
          requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollPosition;
          });
        }
      } catch (error) {
        console.error('Failed to toggle pattern:', error);
        showError('Failed to update pattern');
      }
    },
    [onSettingsChange, showError]
  );

  const handleDeletePattern = useCallback(
    async (patternId: string) => {
      try {
        await deleteCustomPattern(patternId);
        setPatterns((prev) => prev.filter((p) => p.id !== patternId));
        onSettingsChange?.();
        success('Pattern deleted');
      } catch (error) {
        console.error('Failed to delete pattern:', error);
        showError('Failed to delete pattern');
      }
    },
    [onSettingsChange, success, showError]
  );

  const handleValidatePattern = useCallback(async (pattern: string) => {
    if (!pattern) {
      setPatternError(null);
      return;
    }
    setIsValidating(true);
    try {
      await validateRegexPattern(pattern);
      setPatternError(null);
    } catch (error) {
      setPatternError((error as Error).message);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleTestPattern = useCallback(async () => {
    if (!newPattern.pattern || !testInput) return;
    setTestError(null);
    try {
      const results = await testPattern(newPattern.pattern, testInput);
      setTestResults(results);
    } catch (error) {
      setTestError((error as Error).message);
      setTestResults(null);
    }
  }, [newPattern.pattern, testInput]);

  const handleAddPattern = useCallback(async () => {
    if (!newPattern.name || !newPattern.pattern || !newPattern.placeholder) {
      showError('Please fill in all required fields');
      return;
    }

    if (patternError) {
      showError('Please fix the pattern error');
      return;
    }

    const id = `custom_${crypto.randomUUID().replace(/-/g, '_')}`;
    try {
      await addCustomPattern({
        id,
        name: newPattern.name,
        pattern: newPattern.pattern,
        placeholder: newPattern.placeholder,
        enabled: true,
        builtin: false,
        category: newPattern.category || 'Custom',
      });
      await loadData();
      setShowAddForm(false);
      setNewPattern({
        name: '',
        pattern: '',
        placeholder: '',
        category: 'Custom',
        enabled: true,
      });
      setTestInput('');
      setTestResults(null);
      setTestError(null);
      onSettingsChange?.();
      success('Pattern added successfully');
    } catch (error) {
      console.error('Failed to add pattern:', error);
      showError('Failed to add pattern');
    }
  }, [newPattern, patternError, loadData, onSettingsChange, success, showError]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const categorizedPatterns = React.useMemo(() => {
    const result: Record<string, SensitivePattern[]> = {};
    if (!Array.isArray(patterns)) {
      return result;
    }
    for (const p of patterns) {
      if (!result[p.category]) {
        result[p.category] = [];
      }
      result[p.category].push(p);
    }
    return result;
  }, [patterns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/40">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-[11px] font-medium uppercase tracking-widest">Loading...</span>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="sensitive-section-heading">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Shield size={16} className="text-primary" aria-hidden="true" />
        <h3
          id="sensitive-section-heading"
          className="text-[12px] font-bold text-white/70 uppercase tracking-wider"
        >
          Sensitive Data Protection
        </h3>
      </div>

      <div className="p-4 bg-white/5 border border-white/10 rounded-md space-y-4">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="pt-0.5 relative">
            <input
              type="checkbox"
              checked={featureEnabled}
              onChange={handleFeatureToggle}
              className="sr-only"
            />
            <div className={cn(
              "size-4 border rounded bg-black/40 transition-all flex items-center justify-center focus-within:ring-1 focus-within:ring-primary/50",
              featureEnabled ? "bg-primary border-primary" : "border-white/20"
            )}>
              <Check
                size={12}
                className={cn(
                  "text-white transition-transform",
                  featureEnabled ? "scale-100" : "scale-0"
                )}
                aria-hidden="true"
              />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">
              Enable Sensitive Data Protection
            </div>
            <div className="text-[9px] text-white/30 leading-relaxed">
              Automatically detect and redact sensitive information like API keys, passwords, and
              connection strings.
            </div>
          </div>
        </label>

        {featureEnabled && (
          <label className="flex items-start gap-3 cursor-pointer group pl-7">
            <div className="pt-0.5 relative">
              <input
                type="checkbox"
                checked={preventSelectionEnabled}
                onChange={handlePreventToggle}
                className="sr-only"
              />
              <div className={cn(
                "size-4 border rounded bg-black/40 transition-all flex items-center justify-center focus-within:ring-1 focus-within:ring-primary/50",
                preventSelectionEnabled ? "bg-primary border-primary" : "border-white/20"
              )}>
                <Check
                  size={12}
                  className={cn(
                    "text-white transition-transform",
                    preventSelectionEnabled ? "scale-100" : "scale-0"
                  )}
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">
                Prevent Selection of Files with Sensitive Data
              </div>
              <div className="text-[9px] text-white/30 leading-relaxed">
                Files containing sensitive data will be automatically unselected and their checkboxes
                disabled.
              </div>
            </div>
          </label>
        )}
      </div>

      {featureEnabled && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                Detection Patterns
              </span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-2 h-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white transition-all flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-white/30"
              >
                <Plus size={12} aria-hidden="true" />
                ADD CUSTOM
              </button>
            </div>

            {showAddForm && (
              <div className="p-3 bg-black/30 border border-white/10 rounded-md space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-white/40 mb-1">Name</label>
                  <input
                    type="text"
                    value={newPattern.name || ''}
                    onChange={(e) =>
                      setNewPattern((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="My API Key"
                    className="w-full h-7 px-2 bg-black/40 border border-white/10 rounded text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-white/40 mb-1">
                    Regex Pattern
                    {isValidating && <Loader2 className="inline ml-1 animate-spin" size={10} />}
                  </label>
                  <input
                    type="text"
                    value={newPattern.pattern || ''}
                    onChange={(e) => {
                      setNewPattern((prev) => ({ ...prev, pattern: e.target.value }));
                      handleValidatePattern(e.target.value);
                      setTestResults(null);
                      setTestError(null);
                    }}
                    placeholder="\b[A-Z]{2}\d{10}\b"
                    className={cn(
                      'w-full h-7 px-2 bg-black/40 border rounded text-[10px] text-white placeholder:text-white/20 focus:outline-none font-mono',
                      patternError
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-white/10 focus:border-amber-500/50'
                    )}
                  />
                  {patternError && (
                    <div className="flex items-center gap-1 mt-1 text-red-400 text-[9px]">
                      <AlertCircle size={10} />
                      {patternError}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-white/40 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={newPattern.placeholder || ''}
                    onChange={(e) =>
                      setNewPattern((prev) => ({ ...prev, placeholder: e.target.value }))
                    }
                    placeholder="[MY_API_KEY]"
                    className="w-full h-7 px-2 bg-black/40 border border-white/10 rounded text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-white/40 mb-1">
                    Test Pattern
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Enter test text..."
                      className="flex-1 h-7 px-2 bg-black/40 border border-white/10 rounded text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      onClick={handleTestPattern}
                      disabled={!newPattern.pattern || !testInput || !!patternError}
                      className="px-2 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={10} aria-hidden="true" />
                      TEST
                    </button>
                  </div>
                  {testError && (
                    <div className="mt-1 p-2 bg-red-500/10 rounded text-[9px] text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {testError}
                    </div>
                  )}
                  {testResults !== null && !testError && (
                    <div className="mt-1 p-2 bg-black/20 rounded text-[9px] text-white/70">
                      {testResults.length > 0 ? (
                        <>
                          <span className="text-green-400">Matches ({testResults.length}):</span>{' '}
                          {testResults.map((r, i) => (
                            <span key={i} className="bg-white/10 px-1 rounded mr-1">
                              {r}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-amber-400">No matches found</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-bold text-white transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleAddPattern}
                    disabled={
                      !newPattern.name ||
                      !newPattern.pattern ||
                      !newPattern.placeholder ||
                      !!patternError
                    }
                    className="px-3 h-7 bg-primary hover:bg-primary/90 rounded text-[9px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ADD PATTERN
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar" ref={scrollContainerRef}>
              {Object.entries(categorizedPatterns).map(([category, categoryPatterns]) => (
                <div key={category} className="border border-white/5 rounded overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-[10px] font-bold text-white/70">{category}</span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'text-white/30 transition-transform',
                        expandedCategories.has(category) && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {expandedCategories.has(category) && (
                    <div className="divide-y divide-white/5">
                      {categoryPatterns.map((pattern) => (
                        <div
                          key={pattern.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <div className="relative shrink-0">
                              <input
                                type="checkbox"
                                checked={pattern.enabled}
                                onChange={(e) =>
                                  handlePatternToggle(pattern.id, e.target.checked)
                                }
                                className="sr-only"
                              />
                              <div className={cn(
                                "size-4 border rounded bg-black/40 transition-all flex items-center justify-center focus-within:ring-1 focus-within:ring-primary/50",
                                pattern.enabled ? "bg-primary border-primary" : "border-white/20"
                              )}>
                                <Check
                                  size={12}
                                  className={cn(
                                    "text-white transition-transform",
                                    pattern.enabled ? "scale-100" : "scale-0"
                                  )}
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-white truncate">
                                {pattern.name}
                              </div>
                              <div className="text-[9px] text-white/30 font-mono truncate">
                                {pattern.placeholder}
                              </div>
                            </div>
                          </label>
                          {!pattern.builtin && (
                            <button
                              onClick={() => handleDeletePattern(pattern.id)}
                              className="p-1 text-white/20 hover:text-red-400 transition-colors focus:outline-none"
                              aria-label={`Delete ${pattern.name}`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SensitiveDataSettings;