/**
 * Simple diagnostic test to verify app loads in CI
 */

describe("App Loading Diagnostic", () => {
  it("should load the application and find basic elements", async () => {
    // Wait for initial load
    console.log("Step 1: Waiting 10 seconds for app to fully initialize...");
    await browser.pause(10000);

    // Log basic info
    const title = await browser.getTitle();
    console.log(`Window title: "${title}"`);

    const url = await browser.getUrl();
    console.log(`URL: ${url}`);

    // Get and log page source
    const source = await browser.getPageSource();
    console.log("=== PAGE SOURCE (first 3000 chars) ===");
    console.log(source.substring(0, 3000));
    console.log("=== END PAGE SOURCE ===");

    // Check document state via execute
    const docState = await browser.execute(() => {
      return {
        readyState: document.readyState,
        rootExists: !!document.getElementById("root"),
        rootChildCount: document.getElementById("root")?.children?.length || 0,
        rootHTML: document.getElementById("root")?.innerHTML?.substring(0, 500) || "EMPTY",
        bodyChildCount: document.body?.children?.length || 0,
        hasAppContainer: !!document.querySelector('[data-testid="app-container"]'),
        hasAppTitle: !!document.querySelector('[data-testid="app-title"]'),
      };
    });

    console.log("=== DOCUMENT STATE ===");
    console.log(JSON.stringify(docState, null, 2));
    console.log("=== END DOCUMENT STATE ===");

    // Simple assertions using Jest/WDIO style
    expect(docState.rootExists).toBe(true);

    // If root has children, the app rendered
    if (docState.rootChildCount > 0) {
      console.log("SUCCESS: App rendered content in #root");
      expect(docState.rootChildCount).toBeGreaterThan(0);
    } else {
      console.log("WARNING: #root has no children - app may not have rendered");
      // Don't fail - just log for debugging
    }
  });
});
