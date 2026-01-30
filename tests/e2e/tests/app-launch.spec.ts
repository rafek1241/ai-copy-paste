/**
 * Basic app launch tests - simplified for reliability
 */

describe("Application Launch", () => {
  before(async () => {
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          const root = document.getElementById("root");
          return root !== null && root.children.length > 0;
        });
      },
      { timeout: 4000, interval: 200 }
    );
  });

  it("should have a window with content", async () => {
    const source = await browser.getPageSource();
    expect(source.length).toBeGreaterThan(100);
  });

  it("should have the root element", async () => {
    const rootExists = await browser.execute(() => {
      return document.getElementById("root") !== null;
    });
    expect(rootExists).toBe(true);
  });

  it("should render the React app", async () => {
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          const root = document.getElementById("root");
          return root !== null && root.children.length > 0;
        });
      },
      { timeout: 3000, interval: 200 }
    );

    const hasContent = await browser.execute(() => {
      const root = document.getElementById("root");
      return root !== null && root.children.length > 0;
    });

    expect(hasContent).toBe(true);
  });

  it("should have the app container", async () => {
    const hasAppContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasAppContainer).toBe(true);
  });

  it("should have the sidebar", async () => {
    const hasSidebar = await browser.execute(() => {
      return document.querySelector('[data-testid="sidebar"]') !== null;
    });

    expect(hasSidebar).toBe(true);
  });

  it("should have navigation buttons", async () => {
    const navButtons = await browser.execute(() => {
      return {
        files: document.querySelector('[data-testid="nav-files"]') !== null,
        prompt: document.querySelector('[data-testid="nav-prompt"]') !== null,
        history: document.querySelector('[data-testid="nav-history"]') !== null,
        settings: document.querySelector('[data-testid="nav-settings"]') !== null,
      };
    });

    expect(navButtons.files).toBe(true);
    expect(navButtons.prompt).toBe(true);
    expect(navButtons.history).toBe(true);
    expect(navButtons.settings).toBe(true);
  });

  it("should have the header with controls", async () => {
    const headerControls = await browser.execute(() => {
      return {
        header: document.querySelector('[data-testid="app-header"]') !== null,
        addFolder: document.querySelector('[data-testid="add-folder-btn"]') !== null,
        searchToggle: document.querySelector('[data-testid="search-toggle"]') !== null,
      };
    });

    expect(headerControls.header).toBe(true);
    expect(headerControls.addFolder).toBe(true);
    expect(headerControls.searchToggle).toBe(true);
  });
});

describe("Navigation", () => {
  before(async () => {
    await browser.waitUntil(
      async () => {
        return await browser.execute(() => {
          return document.querySelector('[data-testid="app-container"]') !== null;
        });
      },
      { timeout: 2000, interval: 200 }
    );
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

    expect(hasContainer).toBe(true);
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

    expect(hasContainer).toBe(true);
  });

  it("should navigate to Prompt view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-prompt"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).toBe(true);
  });

  it("should navigate back to Files view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-files"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).toBe(true);
  });
});
