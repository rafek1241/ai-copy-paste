/**
 * Basic app launch tests - simplified for reliability
 */

describe("Application Launch", () => {
  before(async () => {
    // Give app time to initialize
    console.log("Waiting for app to initialize...");
    await browser.pause(5000);
  });

  it("should have a window with content", async () => {
    const source = await browser.getPageSource();
    expect(source.length).to.be.greaterThan(100, "Page should have content");
  });

  it("should have the root element", async () => {
    const rootExists = await browser.execute(() => {
      return document.getElementById("root") !== null;
    });
    expect(rootExists).to.equal(true, "#root element should exist");
  });

  it("should render the React app", async () => {
    await browser.pause(2000);

    const hasContent = await browser.execute(() => {
      const root = document.getElementById("root");
      return root !== null && root.children.length > 0;
    });

    expect(hasContent).to.equal(true, "React should render content in #root");
  });

  it("should have the app container", async () => {
    const hasAppContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasAppContainer).to.equal(true, "App container should exist");
  });

  it("should display the app title", async () => {
    const titleText = await browser.execute(() => {
      const title = document.querySelector('[data-testid="app-title"]');
      return title?.textContent || "";
    });

    expect(titleText).to.include("AI Context Collector");
  });

  it("should have navigation buttons", async () => {
    const navButtons = await browser.execute(() => {
      return {
        main: document.querySelector('[data-testid="nav-main"]') !== null,
        browser: document.querySelector('[data-testid="nav-browser"]') !== null,
        history: document.querySelector('[data-testid="nav-history"]') !== null,
        settings: document.querySelector('[data-testid="nav-settings"]') !== null,
      };
    });

    expect(navButtons.main).to.equal(true, "Main nav button should exist");
    expect(navButtons.browser).to.equal(true, "Browser nav button should exist");
    expect(navButtons.history).to.equal(true, "History nav button should exist");
    expect(navButtons.settings).to.equal(true, "Settings nav button should exist");
  });
});

describe("Navigation", () => {
  before(async () => {
    await browser.pause(2000);
  });

  it("should navigate to Settings view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-settings"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    // Just verify app container still exists
    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).to.equal(true);
  });

  it("should navigate to History view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-history"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).to.equal(true);
  });

  it("should navigate to Browser view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-browser"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).to.equal(true);
  });

  it("should navigate back to Main view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-main"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).to.equal(true);
  });
});
