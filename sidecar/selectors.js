/**
 * AI Chat Interface Selectors
 * 
 * Defines selectors for different AI chat interfaces to locate
 * the input field where the prompt should be filled.
 * 
 * NOTE: These URLs and selectors were last verified: January 2026
 * AI interfaces update their UIs frequently. If automation fails,
 * check the actual interface and update selectors accordingly.
 */

export const AI_INTERFACES = {
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chat.openai.com/',
    selectors: [
      // Primary selector for the main input
      '#prompt-textarea',
      // Fallback selectors
      '[contenteditable="true"][data-id="root"]',
      '[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"]',
    ],
    waitForSelector: '#prompt-textarea',
  },
  claude: {
    name: 'Claude',
    url: 'https://claude.ai/',
    selectors: [
      // Primary selector
      '.ProseMirror[contenteditable="true"]',
      // Fallback selectors
      'div[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
    ],
    waitForSelector: 'div[contenteditable="true"]',
  },
  gemini: {
    name: 'Gemini',
    url: 'https://gemini.google.com/',
    selectors: [
      // Primary selector
      '.ql-editor[contenteditable="true"]',
      // Fallback selectors
      'div[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
    ],
    waitForSelector: 'div[contenteditable="true"]',
  },
  aistudio: {
    name: 'AI Studio',
    url: 'https://aistudio.google.com/',
    selectors: [
      // Primary selector
      '.input-area[contenteditable="true"]',
      // Fallback selectors
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
    ],
    waitForSelector: 'div[contenteditable="true"]',
  },
};

/**
 * Get selectors for a specific AI interface
 * @param {string} interfaceName - Name of the AI interface (chatgpt, claude, gemini, aistudio)
 * @returns {Object|null} Interface configuration or null if not found
 */
export function getInterfaceConfig(interfaceName) {
  const normalizedName = interfaceName.toLowerCase();
  return AI_INTERFACES[normalizedName] || null;
}

/**
 * Get all available interface names
 * @returns {string[]} Array of interface names
 */
export function getAvailableInterfaces() {
  return Object.keys(AI_INTERFACES);
}
