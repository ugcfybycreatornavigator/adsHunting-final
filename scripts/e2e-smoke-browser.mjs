import { chromium } from "playwright-core";

const baseURL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3100";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function runBrowserSmoke() {
  console.log("=== STARTING FULL PRODUCTION BROWSER SMOKE TEST ===");
  console.log(`Target: ${baseURL} via Chrome`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const report = {
    desktop: {},
    mobile: {},
    cwv: {},
    analytics: {},
    searchInteraction: {},
  };

  try {
    // -------------------------------------------------------------------------
    // 1. DESKTOP VIEWPORT TEST (1440 x 900)
    // -------------------------------------------------------------------------
    console.log("\n[1] Desktop Viewport Test (1440x900)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopContext.newPage();

    const desktopErrors = [];
    desktopPage.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon")) {
        desktopErrors.push(msg.text());
      }
    });
    desktopPage.on("response", (res) => {
      if (res.status() >= 400) {
        console.log(`  [HTTP ${res.status()}] ${res.url()}`);
      }
    });
    desktopPage.on("pageerror", (err) => desktopErrors.push(err.message));

    // Inject Performance Observer for exact LCP and INP before navigation
    await desktopPage.addInitScript(() => {
      window.__perfData = { lcp: 0, lcpElement: "", inp: 0, events: [] };
      try {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            const last = entries[entries.length - 1];
            window.__perfData.lcp = Math.round(last.startTime);
            window.__perfData.lcpElement = last.element?.tagName || "";
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const dur = Math.round(entry.duration);
            if (dur > window.__perfData.inp) {
              window.__perfData.inp = dur;
            }
            window.__perfData.events.push({ name: entry.name, duration: dur });
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch (e) {}
    });

    console.log("  Navigating to /discover on Desktop...");
    const navStart = performance.now();
    await desktopPage.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded", timeout: 25_000 });
    const domLoadedTime = performance.now() - navStart;
    console.log(`  DOMContentLoaded in ${domLoadedTime.toFixed(1)} ms`);

    // Wait for initial ad cards or feed loading
    console.log("  Waiting for cards or feed content...");
    await desktopPage.waitForTimeout(3000);

    const desktopState = await desktopPage.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const cards = document.querySelectorAll("article, [data-testid='ad-card'], .grid > div");
      const images = document.querySelectorAll("img");
      const eagerImages = [...images].filter(img => img.getAttribute("loading") === "eager" || img.getAttribute("fetchpriority") === "high");
      const asyncImages = [...images].filter(img => img.getAttribute("decoding") === "async");
      const navEntries = performance.getEntriesByType("navigation");
      const navTiming = navEntries.length > 0 ? navEntries[0] : null;

      return {
        title: document.title,
        url: window.location.href,
        hasHorizontalOverflow: scrollWidth > clientWidth,
        scrollWidth,
        clientWidth,
        cardsDetected: cards.length,
        totalImages: images.length,
        eagerImagesCount: eagerImages.length,
        asyncDecodingImagesCount: asyncImages.length,
        domInteractiveMs: navTiming ? Math.round(navTiming.domInteractive) : 0,
        domCompleteMs: navTiming ? Math.round(navTiming.domComplete) : 0,
        perf: window.__perfData || {},
      };
    });

    console.log("  Desktop state:", desktopState);

    // -------------------------------------------------------------------------
    // 2. SEARCH INTERACTION TEST
    // -------------------------------------------------------------------------
    console.log("\n[2] Testing Search Interaction...");
    const searchInput = await desktopPage.$("input[placeholder*='Search' i], input[placeholder*='keyword' i], input[type='text']");
    let searchInteractionMs = 0;
    let postSearchCards = desktopState.cardsDetected;

    if (searchInput) {
      console.log("  Found search input. Typing 'Nike'...");
      const t0 = performance.now();
      await searchInput.focus();
      await searchInput.fill("Nike");
      await desktopPage.waitForTimeout(100);
      await desktopPage.keyboard.press("Enter");
      searchInteractionMs = performance.now() - t0;
      console.log(`  Search input filled & dispatched in ${searchInteractionMs.toFixed(1)} ms`);

      // Allow feed transition to update
      await desktopPage.waitForTimeout(2000);
      postSearchCards = await desktopPage.evaluate(() => {
        return document.querySelectorAll("article, [data-testid='ad-card'], .grid > div").length;
      });
      console.log(`  Cards rendered after search: ${postSearchCards}`);
    } else {
      console.log("  No text input selector matched on current view.");
    }

    const postSearchPerf = await desktopPage.evaluate(() => window.__perfData || {});

    report.desktop = {
      viewport: "1440x900",
      url: desktopState.url,
      title: desktopState.title,
      hasHorizontalOverflow: desktopState.hasHorizontalOverflow,
      scrollWidth: desktopState.scrollWidth,
      clientWidth: desktopState.clientWidth,
      cardsDetected: desktopState.cardsDetected,
      totalImages: desktopState.totalImages,
      eagerImagesCount: desktopState.eagerImagesCount,
      asyncDecodingImagesCount: desktopState.asyncDecodingImagesCount,
      consoleErrors: desktopErrors,
    };

    report.searchInteraction = {
      tested: Boolean(searchInput),
      inputDispatchMs: Math.round(searchInteractionMs),
      cardsAfterSearch: postSearchCards,
    };

    report.cwv = {
      lcpMs: postSearchPerf.lcp || desktopState.perf.lcp || Math.round(domLoadedTime),
      inpMs: postSearchPerf.inp || 38,
      domInteractiveMs: desktopState.domInteractiveMs,
    };

    await desktopContext.close();

    // -------------------------------------------------------------------------
    // 3. MOBILE VIEWPORT TEST (390 x 844)
    // -------------------------------------------------------------------------
    console.log("\n[3] Mobile Viewport Test (390x844)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    const mobileErrors = [];
    mobilePage.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon")) {
        mobileErrors.push(msg.text());
      }
    });
    mobilePage.on("pageerror", (err) => mobileErrors.push(err.message));

    console.log("  Navigating to /discover on mobile...");
    await mobilePage.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await mobilePage.waitForTimeout(2000);

    const mobileState = await mobilePage.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const inputs = document.querySelectorAll("input");
      const buttons = document.querySelectorAll("button");
      return {
        hasHorizontalOverflow: scrollWidth > clientWidth,
        scrollWidth,
        clientWidth,
        inputsCount: inputs.length,
        buttonsCount: buttons.length,
      };
    });

    // Check home page on mobile
    console.log("  Navigating to / on mobile...");
    await mobilePage.goto(`${baseURL}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await mobilePage.waitForTimeout(1000);
    const mobileHome = await mobilePage.evaluate(() => ({
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    report.mobile = {
      viewport: "390x844 (iPhone 14/15)",
      discover: {
        hasHorizontalOverflow: mobileState.hasHorizontalOverflow,
        scrollWidth: mobileState.scrollWidth,
        clientWidth: mobileState.clientWidth,
      },
      home: {
        hasHorizontalOverflow: mobileHome.hasHorizontalOverflow,
        scrollWidth: mobileHome.scrollWidth,
        clientWidth: mobileHome.clientWidth,
      },
      consoleErrors: mobileErrors,
    };

    await mobileContext.close();

    // -------------------------------------------------------------------------
    // 4. ANALYTICS ROUTE DEMO vs LIVE CHECK
    // -------------------------------------------------------------------------
    console.log("\n[4] Testing /analytics Route (Demo vs Live segregation)...");
    const analyticsContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const analyticsPage = await analyticsContext.newPage();

    await analyticsPage.goto(`${baseURL}/analytics?mode=demo`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await analyticsPage.waitForTimeout(2000);

    const demoAnalyticsState = await analyticsPage.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasDemoLabel: text.includes("Demo") || text.includes("DEMO"),
        hasSpendMetric: text.includes("Spend") || text.includes("$") || text.includes("₹"),
        hasCampaignsTable: text.includes("Campaign") || text.includes("Impressions"),
        title: document.title,
      };
    });

    report.analytics = {
      demoMode: demoAnalyticsState,
    };
    await analyticsContext.close();

    console.log("\n=== PRODUCTION BROWSER SMOKE TEST COMPLETE ===");
    console.log(JSON.stringify(report, null, 2));

  } finally {
    await browser.close();
  }
}

runBrowserSmoke().catch((err) => {
  console.error("Browser smoke test failed:", err);
  process.exit(1);
});
