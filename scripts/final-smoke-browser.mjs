import { chromium, firefox, webkit } from "playwright-core";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3100";
const widths = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
const routes = ["/", "/pricing", "/resources/help", "/contact"];
const engines = { chromium, firefox, webkit };
const results = [];

for (const [engineName, engine] of Object.entries(engines)) {
  let browser;
  try {
    const launchOptions = { headless: true };
    if (engineName === "chromium" && process.env.CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await engine.launch(launchOptions);
    const engineWidths = engineName === "chromium" ? widths : [390, 1280];

    for (const width of engineWidths) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const consoleErrors = [];
        const pageErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        const response = await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
        const evidence = await page.evaluate(() => {
          const unlabeledButtons = [...document.querySelectorAll("button")].filter((button) => {
            const label = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent;
            return !label?.trim();
          }).length;
          const imagesMissingAlt = [...document.querySelectorAll("img")].filter((image) => !image.hasAttribute("alt")).length;
          const navigation = performance.getEntriesByType("navigation")[0];
          return {
            title: document.title,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            h1Count: document.querySelectorAll("h1").length,
            unlabeledButtons,
            imagesMissingAlt,
            domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
            loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
          };
        });

        results.push({ engine: engineName, width, route, status: response?.status(), consoleErrors, pageErrors, ...evidence });
        await page.close();
      }
    }
  } catch (error) {
    results.push({ engine: engineName, blocked: true, error: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }
}

console.log(JSON.stringify(results, null, 2));
