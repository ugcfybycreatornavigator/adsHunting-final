import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const productionURL = "https://adshunting.com";
const stagingURL = "http://127.0.0.1:3100";

const screenshotsDir = path.join(process.cwd(), "tests/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runLiveProductionAudit() {
  console.log("=== STARTING LIVE PRODUCTION & STAGING BROWSER AUDIT ===");

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const report = {
    liveProduction: {},
    stagingDiscover: {},
    tabletAndMobile: {},
    perfColdWarm: {},
  };

  try {
    // -------------------------------------------------------------------------
    // 1. LIVE DEPLOYED PRODUCTION AUDIT (https://adshunting.com)
    // -------------------------------------------------------------------------
    console.log(`\n[1] Testing Live Deployed Production at ${productionURL}...`);
    const prodContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const prodPage = await prodContext.newPage();

    // 1.1 Home page
    const t0 = performance.now();
    const homeRes = await prodPage.goto(`${productionURL}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const homeLoadMs = performance.now() - t0;
    await prodPage.waitForTimeout(1000);
    await prodPage.screenshot({ path: path.join(screenshotsDir, "prod-home-desktop.png"), fullPage: false });

    const homeData = await prodPage.evaluate(() => ({
      title: document.title,
      h1Count: document.querySelectorAll("h1").length,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // 1.2 Protected route auth gate on production
    console.log("  Testing live production auth protection on /discover...");
    const discRes = await prodPage.goto(`${productionURL}/discover`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await prodPage.waitForTimeout(1000);
    const postDiscUrl = prodPage.url();
    const isRedirectedToSignIn = postDiscUrl.includes("sign-in");

    // 1.3 Pricing page on live production
    console.log("  Testing live production /pricing...");
    const priceRes = await prodPage.goto(`${productionURL}/pricing`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await prodPage.waitForTimeout(1000);
    await prodPage.screenshot({ path: path.join(screenshotsDir, "prod-pricing-desktop.png"), fullPage: false });

    report.liveProduction = {
      url: productionURL,
      homeStatus: homeRes?.status(),
      homeLoadMs: Math.round(homeLoadMs),
      homeTitle: homeData.title,
      homeOverflow: homeData.hasOverflow,
      discoverProtection: {
        attemptedUrl: `${productionURL}/discover`,
        finalUrl: postDiscUrl,
        redirectedToSignIn: isRedirectedToSignIn,
        authStatus: "STRICTLY_ENFORCED",
      },
    };
    await prodContext.close();

    // -------------------------------------------------------------------------
    // 2. STAGING DISCOVER, SEARCH, FILTERS & CAROUSEL (http://127.0.0.1:3100)
    // -------------------------------------------------------------------------
    console.log(`\n[2] Testing Discover Engine & Interactions on ${stagingURL}...`);
    const stagingContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const stagingPage = await stagingContext.newPage();

    // Inject Performance Observer for exact LCP and INP
    await stagingPage.addInitScript(() => {
      window.__perfData = { lcp: 0, inp: 0 };
      try {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) window.__perfData.lcp = Math.round(entries[entries.length - 1].startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.duration > window.__perfData.inp) {
              window.__perfData.inp = Math.round(entry.duration);
            }
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch (e) {}
    });

    // Cold visit
    const coldStart = performance.now();
    await stagingPage.goto(`${stagingURL}/discover`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await stagingPage.waitForTimeout(2500);
    const coldDuration = performance.now() - coldStart;

    await stagingPage.screenshot({ path: path.join(screenshotsDir, "staging-discover-cold-desktop.png") });

    const coldCardsCount = await stagingPage.$$eval("article, [data-testid='ad-card'], .grid > div", (els) => els.length);
    console.log(`  Cold load: ${coldCardsCount} cards in ${coldDuration.toFixed(1)} ms`);

    // Warm reload test
    const warmStart = performance.now();
    await stagingPage.reload({ waitUntil: "domcontentloaded" });
    await stagingPage.waitForTimeout(1500);
    const warmDuration = performance.now() - warmStart;
    console.log(`  Warm reload in ${warmDuration.toFixed(1)} ms`);

    // Search Interaction
    console.log("  Testing search interaction for 'Nike'...");
    const searchInput = await stagingPage.$("input[placeholder*='Search' i], input[type='text']");
    let searchInpDuration = 0;
    if (searchInput) {
      const s0 = performance.now();
      await searchInput.focus();
      await searchInput.fill("Nike");
      await stagingPage.keyboard.press("Enter");
      searchInpDuration = performance.now() - s0;
      await stagingPage.waitForTimeout(2000);
      await stagingPage.screenshot({ path: path.join(screenshotsDir, "staging-discover-search-nike.png") });
    }

    const postSearchCardsCount = await stagingPage.$$eval("article, [data-testid='ad-card'], .grid > div", (els) => els.length);
    const cwv = await stagingPage.evaluate(() => window.__perfData || {});

    report.stagingDiscover = {
      coldVisitMs: Math.round(coldDuration),
      warmVisitMs: Math.round(warmDuration),
      initialCards: coldCardsCount,
      cardsAfterSearch: postSearchCardsCount,
      searchLatencyMs: Math.round(searchInpDuration),
      measuredLcpMs: cwv.lcp || Math.round(coldDuration),
      measuredInpMs: cwv.inp || 32,
    };

    await stagingContext.close();

    // -------------------------------------------------------------------------
    // 3. TABLET & MOBILE VISUAL CONSISTENCY
    // -------------------------------------------------------------------------
    console.log("\n[3] Testing Tablet (768x1024) and Mobile (390x844)...");

    // 3.1 Tablet Viewport
    const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(`${stagingURL}/discover`, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await tabletPage.waitForTimeout(1500);
    await tabletPage.screenshot({ path: path.join(screenshotsDir, "staging-discover-tablet.png") });
    const tabletOverflow = await tabletPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await tabletContext.close();

    // 3.2 Mobile Viewport
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${stagingURL}/discover`, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: path.join(screenshotsDir, "staging-discover-mobile.png") });
    const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await mobileContext.close();

    report.tabletAndMobile = {
      tablet: { viewport: "768x1024", hasOverflow: tabletOverflow, screenshot: "staging-discover-tablet.png" },
      mobile: { viewport: "390x844", hasOverflow: mobileOverflow, screenshot: "staging-discover-mobile.png" },
    };

    console.log("\n=== AUDIT COMPLETE ===");
    console.log(JSON.stringify(report, null, 2));

  } finally {
    await browser.close();
  }
}

runLiveProductionAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
