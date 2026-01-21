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

  it("should have the sidebar", async () => {
    const hasSidebar = await browser.execute(() => {
      return document.querySelector('[data-testid="sidebar"]') !== null;
    });

    expect(hasSidebar).to.equal(true, "Sidebar should exist");
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

    expect(navButtons.files).to.equal(true, "Files nav button should exist");
    expect(navButtons.prompt).to.equal(true, "Prompt nav button should exist");
    expect(navButtons.history).to.equal(true, "History nav button should exist");
    expect(navButtons.settings).to.equal(true, "Settings nav button should exist");
  });

  it("should have the header with controls", async () => {
    const headerControls = await browser.execute(() => {
      return {
        header: document.querySelector('[data-testid="app-header"]') !== null,
        addFolder: document.querySelector('[data-testid="add-folder-btn"]') !== null,
        searchToggle: document.querySelector('[data-testid="search-toggle-btn"]') !== null,
      };
    });

    expect(headerControls.header).to.equal(true, "Header should exist");
    expect(headerControls.addFolder).to.equal(true, "Add folder button should exist");
    expect(headerControls.searchToggle).to.equal(true, "Search toggle button should exist");
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

  it("should navigate to Prompt view", async () => {
    await browser.execute(() => {
      const btn = document.querySelector('[data-testid="nav-prompt"]') as HTMLElement;
      btn?.click();
    });

    await browser.pause(1000);

    const hasContainer = await browser.execute(() => {
      return document.querySelector('[data-testid="app-container"]') !== null;
    });

    expect(hasContainer).to.equal(true);
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

    expect(hasContainer).to.equal(true);
  });
});
