/**
 * Centralized selectors for E2E tests
 * Using data-testid attributes for reliability
 */

export const Selectors = {
  // App Header & Navigation
  appContainer: '[data-testid="app-container"]',
  appHeader: '[data-testid="app-header"]',
  appTitle: '[data-testid="app-title"]',
  sidebar: '[data-testid="sidebar"]',
  navFiles: '[data-testid="nav-files"]',
  navPrompt: '[data-testid="nav-prompt"]',
  navHistory: '[data-testid="nav-history"]',
  navSettings: '[data-testid="nav-settings"]',
  selectionInfo: '[data-testid="selection-info"]',

  // Header controls
  addFolderBtn: '[data-testid="add-folder-btn"]',
  clearContextBtn: '[data-testid="clear-context-btn"]',
  searchToggleBtn: '[data-testid="search-toggle-btn"]',
  clearSearchBtn: '[data-testid="clear-search-btn"]',
  searchTooltip: '[data-testid="search-tooltip"]',

  // File Tree
  fileTreeContainer: '[data-testid="file-tree-container"]',
  fileTreeSearch: '[data-testid="file-tree-search"]',
  fileTreeScroll: '[data-testid="file-tree-scroll"]',
  emptyState: '[data-testid="empty-state"]',
  treeNode: '[data-testid="tree-node"]',
  treeNodeFolder: '[data-testid="tree-node"][data-node-type="folder"]',
  treeNodeFile: '[data-testid="tree-node"][data-node-type="file"]',
  expandIcon: '[data-testid="expand-icon"]',
  treeCheckbox: '[data-testid="tree-checkbox"]',
  treeLabel: '[data-testid="tree-label"]',
  treeIcon: '[data-testid="tree-icon"]',

  // Prompt Builder
  promptBuilder: '[data-testid="prompt-builder"]',
  templateSelect: '[data-testid="template-select"]',
  modelSelect: '[data-testid="model-select"]',
  customInstructions: '[data-testid="custom-instructions"]',
  selectedFilesInfo: '[data-testid="selected-files-info"]',
  buildPromptBtn: '[data-testid="build-prompt-btn"]',
  errorDisplay: '[data-testid="error-display"]',
  promptPreview: '[data-testid="prompt-preview"]',
  copyToClipboardBtn: '[data-testid="copy-clipboard-btn"]',

  // Token Counter
  tokenCounter: '[data-testid="token-counter"]',
  tokenCount: '[data-testid="token-count"]',
  tokenLimit: '[data-testid="token-limit"]',
  tokenWarning: '[data-testid="token-warning"]',

  // Settings
  settingsContainer: '[data-testid="settings-container"]',
  settingsForm: '[data-testid="settings-form"]',
  excludedExtensions: '[data-testid="excluded-extensions"]',
  tokenLimitSetting: '[data-testid="token-limit-setting"]',
  cacheSizeSetting: '[data-testid="cache-size-setting"]',
  saveSettingsBtn: '[data-testid="save-settings-btn"]',
  resetSettingsBtn: '[data-testid="reset-settings-btn"]',
  exportSettingsBtn: '[data-testid="export-settings-btn"]',
  importSettingsBtn: '[data-testid="import-settings-btn"]',

  // History Panel
  historyContainer: '[data-testid="history-container"]',
  historyList: '[data-testid="history-list"]',
  historyEntry: '[data-testid="history-entry"]',
  historyRestoreBtn: '[data-testid="history-restore-btn"]',
  historyDeleteBtn: '[data-testid="history-delete-btn"]',
  historyClearBtn: '[data-testid="history-clear-btn"]',

  // Browser Automation
  browserAutomation: '[data-testid="browser-automation"]',
  interfaceSelect: '[data-testid="interface-select"]',
  promptTextarea: '[data-testid="prompt-textarea"]',
  customUrlInput: '[data-testid="custom-url-input"]',
  launchBrowserBtn: '[data-testid="launch-browser-btn"]',
};

/**
 * Alternative selectors when data-testid is not available
 * These are fallback selectors based on CSS classes and structure
 */
export const FallbackSelectors = {
  // App
  appContainer: "#root > div",
  appHeader: "header",
  appTitle: ".app-header h1",

  // Navigation buttons (sidebar icons by title)
  navFiles: 'button[title="Files"]',
  navPrompt: 'button[title="Prompt"]',
  navHistory: 'button[title="History"]',
  navSettings: 'button[title="Settings"]',

  // Header controls
  addFolderBtn: 'button[title="Add Folder to Index"]',
  clearContextBtn: 'button[title="Clear Context"]',
  searchToggleBtn: 'button[title="Search"]',

  // File Tree
  fileTreeContainer: '[data-testid="file-tree-container"]',
  fileTreeSearch: 'input[placeholder="Search files..."]',
  fileTreeScroll: '[data-testid="file-tree-scroll"]',
  emptyState: '[data-testid="empty-state"]',
  treeNode: '[data-testid="tree-node"]',
  expandIcon: '[data-testid="expand-icon"]',
  treeCheckbox: '[data-testid="tree-checkbox"], input[type="checkbox"]',
  treeLabel: '[data-testid="tree-label"]',

  // Prompt Builder
  templateSelect: 'select:near(label:has-text("Select Template"))',
  modelSelect: 'select:near(label:has-text("Target AI Model"))',
  customInstructions: 'textarea[placeholder*="specific instructions"]',
  buildPromptBtn: 'button:has-text("Build")',
  copyToClipboardBtn: 'button:has-text("Copy to Clipboard")',
};

/**
 * Get selector with fallback
 */
export function getSelector(key: keyof typeof Selectors): string {
  return Selectors[key];
}
