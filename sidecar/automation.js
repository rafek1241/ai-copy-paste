/**
 * Browser Automation Sidecar
 * 
 * This script launches a browser with Playwright, navigates to an AI chat interface,
 * fills the prompt, and then disconnects while keeping the browser running.
 * 
 * Usage:
 *   node automation.js <interface> <text> [url]
 *   
 * Arguments:
 *   interface - AI interface name (chatgpt, claude, gemini, aistudio)
 *   text - The prompt text to fill
 *   url - Optional custom URL (overrides default interface URL)
 */

import { chromium } from 'playwright';
import { getInterfaceConfig, getAvailableInterfaces } from './selectors.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node automation.js <interface> <text> [url]');
    console.error(`Available interfaces: ${getAvailableInterfaces().join(', ')}`);
    process.exit(1);
  }

  return {
    interface: args[0],
    text: args[1],
    url: args[2] || null,
  };
}

/**
 * Try to fill the input using multiple strategies
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string[]} selectors - Array of selectors to try
 * @param {string} text - Text to fill
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function tryFillInput(page, selectors, text) {
  for (const selector of selectors) {
    try {
      console.log(`Trying selector: ${selector}`);
      const element = page.locator(selector).first();
      
      // Wait for element to be visible
      await element.waitFor({ state: 'visible', timeout: 5000 });
      
      // Try the fill method first (fastest)
      try {
        await element.fill(text);
        console.log(`✓ Successfully filled using .fill() with selector: ${selector}`);
        return true;
      } catch (fillError) {
        console.log(`Fill method failed, trying click + type...`);
        
        // Fallback: Click and type character by character
        await element.click();
        await page.keyboard.type(text, { delay: 10 });
        console.log(`✓ Successfully filled using .type() with selector: ${selector}`);
        return true;
      }
    } catch (error) {
      console.log(`✗ Failed with selector ${selector}: ${error.message}`);
      continue;
    }
  }
  
  return false;
}

/**
 * Launch browser and fill AI chat interface
 * @param {string} interfaceName - Name of the AI interface
 * @param {string} text - Prompt text to fill
 * @param {string|null} customUrl - Optional custom URL
 */
async function fillAndLeaveOpen(interfaceName, text, customUrl = null) {
  console.log(`\n=== AI Context Collector - Browser Automation ===`);
  console.log(`Interface: ${interfaceName}`);
  console.log(`Prompt length: ${text.length} characters`);
  
  // Get interface configuration
  const config = getInterfaceConfig(interfaceName);
  if (!config) {
    console.error(`✗ Unknown interface: ${interfaceName}`);
    console.error(`Available interfaces: ${getAvailableInterfaces().join(', ')}`);
    process.exit(1);
  }
  
  const targetUrl = customUrl || config.url;
  console.log(`Target URL: ${targetUrl}`);
  
  // Create browser data directory in a persistent location
  const browserDataDir = join(__dirname, '.browser-data');
  console.log(`Browser data directory: ${browserDataDir}`);
  
  let context;
  try {
    console.log('\nLaunching browser...');
    
    // Launch persistent context - this is the key to keeping browser open
    context = await chromium.launchPersistentContext(browserDataDir, {
      headless: false,
      channel: 'chrome', // Use system Chrome if available
      args: [
        '--disable-blink-features=AutomationControlled', // Anti-automation mitigation
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      viewport: { width: 1280, height: 720 },
    });
    
    console.log('✓ Browser launched successfully');
    
    // Get or create page
    const page = context.pages()[0] || await context.newPage();
    
    console.log(`\nNavigating to ${targetUrl}...`);
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log('✓ Page loaded');
    
    // Wait for the expected input field to appear
    console.log(`\nWaiting for input field: ${config.waitForSelector}...`);
    try {
      await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      console.log('✓ Input field detected');
    } catch (error) {
      console.warn(`⚠ Could not detect expected input field, will try all selectors anyway`);
    }
    
    // Try to fill the input
    console.log('\nAttempting to fill prompt...');
    const success = await tryFillInput(page, config.selectors, text);
    
    if (success) {
      console.log('\n✓ Prompt filled successfully!');
      console.log('\n=== Browser remains open for user interaction ===');
      console.log('The user can now review and submit the prompt.');
      console.log('This script will exit, but the browser will stay running.');
    } else {
      console.error('\n✗ Failed to fill prompt with all available selectors');
      console.error('The browser will remain open for manual interaction.');
    }
    
  } catch (error) {
    console.error('\n✗ Error during automation:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    // Still keep browser open even on error
    console.log('\nBrowser will remain open for manual interaction.');
  }
  
  // CRITICAL: Do NOT close context - this is the key to keeping browser open
  // The browser process will continue running after Node.js exits
  console.log('\nScript exiting. Browser persists.');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  const { interface: interfaceName, text, url } = parseArgs();
  await fillAndLeaveOpen(interfaceName, text, url);
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
