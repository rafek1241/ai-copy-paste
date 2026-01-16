import { AppPage } from "../utils/pages";

describe("Application Launch", () => {
  const appPage = new AppPage();

  before(async () => {
    // Wait for app to be ready
    await appPage.waitForLoad();
  });

  it("should launch the application successfully", async () => {
    // Verify window title
    const title = await browser.getTitle();
    expect(title).to.include("ai-copy-paste");
  });

  it("should display the application header with title", async () => {
    const appTitle = await appPage.getTitle();
    expect(appTitle).to.include("AI Context Collector");
  });

  it("should display all navigation buttons", async () => {
    // Check for Main button
    const mainBtn = await $('button*=Main');
    expect(await mainBtn.isDisplayed()).to.be.true;

    // Check for Browser button
    const browserBtn = await $('button*=Browser');
    expect(await browserBtn.isDisplayed()).to.be.true;

    // Check for History button
    const historyBtn = await $('button*=History');
    expect(await historyBtn.isDisplayed()).to.be.true;

    // Check for Settings button
    const settingsBtn = await $('button*=Settings');
    expect(await settingsBtn.isDisplayed()).to.be.true;
  });

  it("should start in the Main view by default", async () => {
    const isFileTreeDisplayed = await appPage.isFileTreeDisplayed();
    expect(isFileTreeDisplayed).to.be.true;
  });

  it("should have the correct window dimensions", async () => {
    const windowSize = await browser.getWindowSize();

    // Window should have reasonable dimensions (as configured in tauri.conf.json)
    expect(windowSize.width).to.be.at.least(800);
    expect(windowSize.height).to.be.at.least(600);
  });
});

describe("Navigation", () => {
  const appPage = new AppPage();

  before(async () => {
    await appPage.waitForLoad();
  });

  beforeEach(async () => {
    // Reset to main view before each test
    await appPage.navigateToMain();
    await browser.pause(300);
  });

  it("should navigate to Main view", async () => {
    await appPage.navigateToMain();

    // Verify File Tree is visible (Main view indicator)
    const isFileTreeDisplayed = await appPage.isFileTreeDisplayed();
    expect(isFileTreeDisplayed).to.be.true;
  });

  it("should navigate to Browser Automation view", async () => {
    await appPage.navigateToBrowser();

    // Verify Browser Automation content is visible
    const heading = await $("h2");
    const text = await heading.getText();
    expect(text.toLowerCase()).to.include("browser");
  });

  it("should navigate to History view", async () => {
    await appPage.navigateToHistory();

    // Verify History content is visible
    const heading = await $("h2");
    const text = await heading.getText();
    expect(text.toLowerCase()).to.satisfy((t: string) =>
      t.includes("history") || t.includes("session")
    );
  });

  it("should navigate to Settings view", async () => {
    await appPage.navigateToSettings();

    // Verify Settings content is visible
    const heading = await $("h2");
    const text = await heading.getText();
    expect(text.toLowerCase()).to.include("settings");
  });

  it("should preserve view state when navigating between views", async () => {
    // Navigate to Settings
    await appPage.navigateToSettings();

    // Navigate to History
    await appPage.navigateToHistory();

    // Navigate back to Main
    await appPage.navigateToMain();

    // Verify we're back in Main view
    const isFileTreeDisplayed = await appPage.isFileTreeDisplayed();
    expect(isFileTreeDisplayed).to.be.true;
  });

  it("should highlight the active navigation button", async () => {
    // Navigate to Settings
    await appPage.navigateToSettings();

    // Check that Settings button has active style
    const buttons = await $$("button");
    let settingsButtonStyle = "";

    for (const button of buttons) {
      const text = await button.getText();
      if (text === "Settings") {
        settingsButtonStyle = await button.getAttribute("style") || "";
        break;
      }
    }

    // Active button should have the active background color
    expect(settingsButtonStyle).to.include("#0e639c");
  });
});
