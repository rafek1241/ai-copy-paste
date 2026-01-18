/**
 * Centralized selectors for E2E tests
 * Using data-testid attributes for reliability
 */

export const Selectors = {
  // App Header & Navigation
  appContainer: '[data-testid="app-container"]',
  appHeader: '[data-testid="app-header"]',
  appTitle: '[data-testid="app-title"]',
  navMain: '[data-testid="nav-main"]',
  navBrowser: '[data-testid="nav-browser"]',
  navHistory: '[data-testid="nav-history"]',
  navSettings: '[data-testid="nav-settings"]',
  selectionInfo: '[data-testid="selection-info"]',

  // File Tree
  fileTreeContainer: '[data-testid="file-tree-container"]',
  fileTreeSearch: '[data-testid="file-tree-search"]',
  addFolderBtn: '[data-testid="add-folder-btn"]',
  fileTreeScroll: '[data-testid="file-tree-scroll"]',
  emptyState: '[data-testid="empty-state"]',
  treeNode: '[data-testid="tree-node"]',
  expandIcon: '[data-testid="expand-icon"]',
  treeCheckbox: '[data-testid="tree-checkbox"]',
  treeLabel: '[data-testid="tree-label"]',

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
  appContainer: ".app-container",
  appHeader: ".app-header",
  appTitle: ".app-header h1",

  // Navigation buttons (using text content)
  navMain: 'button:has-text("Main")',
  navBrowser: 'button:has-text("Browser")',
  navHistory: 'button:has-text("History")',
  navSettings: 'button:has-text("Settings")',

  // File Tree
  fileTreeContainer: ".file-tree-container",
  fileTreeSearch: ".search-input",
  addFolderBtn: ".add-folder-btn",
  fileTreeScroll: ".file-tree-scroll",
  emptyState: ".empty-state",
  treeNode: ".tree-node",
  expandIcon: ".expand-icon",
  treeCheckbox: ".tree-checkbox",
  treeLabel: ".tree-label",

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
