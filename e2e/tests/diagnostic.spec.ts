/**
 * Diagnostic test to understand app loading issues in CI
 * This test captures detailed information about the app state
 */

describe("Diagnostic Test", () => {
  it("should capture app state for debugging", async () => {
    console.log("=== DIAGNOSTIC TEST START ===");

    // Wait a bit for app to initialize
    console.log("Waiting 5 seconds for app to initialize...");
    await browser.pause(5000);

    // Get window info
    try {
      const title = await browser.getTitle();
      console.log(`Window title: "${title}"`);
    } catch (e) {
      console.log(`Error getting title: ${e}`);
    }

    // Get URL
    try {
      const url = await browser.getUrl();
      console.log(`Current URL: ${url}`);
    } catch (e) {
      console.log(`Error getting URL: ${e}`);
    }

    // Get page source
    try {
      const pageSource = await browser.getPageSource();
      console.log("=== PAGE SOURCE START ===");
      console.log(pageSource);
      console.log("=== PAGE SOURCE END ===");
    } catch (e) {
      console.log(`Error getting page source: ${e}`);
    }

    // Try to find any elements
    try {
      const allElements = await $$("*");
      console.log(`Total elements found: ${allElements.length}`);

      // Get root element
      const root = await $("#root");
      const rootExists = await root.isExisting();
      console.log(`#root exists: ${rootExists}`);

      if (rootExists) {
        const rootHtml = await root.getHTML();
        console.log(`#root HTML length: ${rootHtml.length}`);
        console.log(`#root HTML: ${rootHtml.substring(0, 500)}`);
      }
    } catch (e) {
      console.log(`Error checking elements: ${e}`);
    }

    // Check if there are any script errors
    try {
      const logs = await browser.getLogs("browser");
      console.log("=== BROWSER LOGS ===");
      for (const log of logs) {
        console.log(`[${log.level}] ${log.message}`);
      }
      console.log("=== END BROWSER LOGS ===");
    } catch (e) {
      console.log(`Error getting browser logs: ${e}`);
    }

    // Execute JavaScript to check document state
    try {
      const docInfo = await browser.execute(() => {
        return {
          readyState: document.readyState,
          bodyChildren: document.body?.children?.length || 0,
          rootChildren: document.getElementById("root")?.children?.length || 0,
          rootInnerHTML: document.getElementById("root")?.innerHTML?.substring(0, 200) || "empty",
          hasScripts: document.querySelectorAll("script").length,
          location: window.location.href,
        };
      });
      console.log("=== DOCUMENT INFO ===");
      console.log(JSON.stringify(docInfo, null, 2));
      console.log("=== END DOCUMENT INFO ===");
    } catch (e) {
      console.log(`Error executing script: ${e}`);
    }

    console.log("=== DIAGNOSTIC TEST END ===");

    // This test always passes - it's just for debugging
    expect(true).to.be.true;
  });
});
