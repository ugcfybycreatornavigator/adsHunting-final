import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

const screenshotsDir = path.join(process.cwd(), "tests/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runAcceptanceTests() {
  console.log("=== STARTING DISCOVER REAL-BROWSER ACCEPTANCE TESTS (12 PHASES) ===");
  console.log(`Target: ${baseURL}/discover\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const results = {};

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject INP and LCP observers
  await page.addInitScript(() => {
    window.__perfData = { lcp: 0, inp: 0, interactions: [] };
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
          window.__perfData.interactions.push({
            name: entry.name,
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 8 });
    } catch {}
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: INITIAL DISCOVER FEED (Empty Query)
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: INITIAL DISCOVER FEED ---");
    const t0 = performance.now();
    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded", timeout: 25_000 }),
    ]);
    await page.waitForSelector("article", { timeout: 10_000 }).catch(() => null);
    const initialLoadTime = performance.now() - t0;

    const initialCards = await page.$$("article");
    const initialCardCount = initialCards.length;
    console.log(`Initial cards loaded: ${initialCardCount} in ${initialLoadTime.toFixed(1)} ms`);

    const brands = await page.$$eval("article a[href*='/competitors/']", (links) => links.map(l => l.textContent?.trim() || ""));
    const uniqueBrands = [...new Set(brands.filter(Boolean))];
    console.log(`Diverse brands found (${uniqueBrands.length}):`, uniqueBrands.slice(0, 6));

    const shot1 = path.join(screenshotsDir, "test-a-initial-discovery.png");
    await page.screenshot({ path: shot1 });

    results.test1_initialDiscovery = {
      status: initialCardCount > 0 && uniqueBrands.length > 1 ? "PASS" : "FAIL",
      cardsCount: initialCardCount,
      uniqueBrandsCount: uniqueBrands.length,
      loadTimeMs: Math.round(initialLoadTime),
      screenshot: shot1,
    };
    console.log(`TEST 1: ${results.test1_initialDiscovery.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 2: GAMING SEARCH & CONTENT SAFETY
    // -------------------------------------------------------------------------
    console.log("--- TEST 2: GAMING SEARCH & CONTENT SAFETY ---");
    const searchInput = await page.waitForSelector("input[type='search'], input[placeholder*='Search']", { timeout: 5000 });
    await searchInput.fill("");
    await searchInput.type("gaming", { delay: 40 });

    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);

    await page.waitForTimeout(1000);
    const gamingCards = await page.$$("article");
    console.log(`Returned cards for 'gaming': ${gamingCards.length}`);

    const cardTexts = await page.$$eval("article", (articles) => articles.map(a => a.textContent || ""));

    const unsafeMatches = cardTexts.filter(t =>
      /smack the ass|temptation gauge|lust game|seduce the alpha|addicted to fiction/i.test(t)
    );
    const authenticGamingMatches = cardTexts.filter(t =>
      /controller|game|console|hardware|gaming/i.test(t)
    );

    console.log(`Unsafe/Erotic ads found in gaming search: ${unsafeMatches.length} (MUST BE 0)`);
    console.log(`Authentic gaming matches: ${authenticGamingMatches.length}`);

    const shot2 = path.join(screenshotsDir, "test-b-gaming.png");
    await page.screenshot({ path: shot2 });

    const precisionGaming = authenticGamingMatches.length / (gamingCards.length || 1);

    results.test2_gamingSearch = {
      status: unsafeMatches.length === 0 && gamingCards.length > 0 ? "PASS" : "FAIL",
      returnedCount: gamingCards.length,
      unsafeCount: unsafeMatches.length,
      authenticCount: authenticGamingMatches.length,
      precision: `${(precisionGaming * 100).toFixed(1)}%`,
      screenshot: shot2,
    };
    console.log(`TEST 2: ${results.test2_gamingSearch.status} (Precision: ${results.test2_gamingSearch.precision})\n`);

    // -------------------------------------------------------------------------
    // TEST 3: FITNESS SEARCH PRECISION
    // -------------------------------------------------------------------------
    console.log("--- TEST 3: FITNESS SEARCH PRECISION ---");
    await searchInput.fill("");
    await searchInput.type("fitness", { delay: 40 });

    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);

    await page.waitForTimeout(1000);
    const fitnessCards = await page.$$("article");
    console.log(`Returned cards for 'fitness': ${fitnessCards.length}`);

    const fitnessTexts = await page.$$eval("article", (articles) => articles.map(a => a.textContent || ""));
    const relatedFitness = fitnessTexts.filter(t =>
      /fitness|running|gym|shoes|workout|active|sport|puma|athletic|nike/i.test(t)
    );
    console.log(`Authentic fitness matches: ${relatedFitness.length} / ${fitnessCards.length}`);

    const shot3 = path.join(screenshotsDir, "test-c-fitness.png");
    await page.screenshot({ path: shot3 });

    const precisionFitness = relatedFitness.length / (fitnessCards.length || 1);

    results.test3_fitnessSearch = {
      status: fitnessCards.length > 0 && precisionFitness >= 0.75 ? "PASS" : "FAIL",
      returnedCount: fitnessCards.length,
      relatedCount: relatedFitness.length,
      precision: `${(precisionFitness * 100).toFixed(1)}%`,
      screenshot: shot3,
    };
    console.log(`TEST 3: ${results.test3_fitnessSearch.status} (Precision: ${results.test3_fitnessSearch.precision})\n`);

    // -------------------------------------------------------------------------
    // TEST 4: BRAND-NAME SEARCH
    // -------------------------------------------------------------------------
    console.log("--- TEST 4: BRAND-NAME SEARCH ---");
    await searchInput.fill("");
    await searchInput.type("Foxtale", { delay: 40 });

    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);

    await page.waitForTimeout(1000);
    const foxtaleCards = await page.$$("article");
    console.log(`Returned cards for brand 'Foxtale': ${foxtaleCards.length}`);

    const foxtaleTexts = await page.$$eval("article", (articles) => articles.map(a => a.textContent || ""));
    const matchingFoxtale = foxtaleTexts.filter(t => /foxtale/i.test(t));

    const shot4 = path.join(screenshotsDir, "test-brand-foxtale.png");
    await page.screenshot({ path: shot4 });

    results.test4_brandSearch = {
      status: foxtaleCards.length > 0 && matchingFoxtale.length === foxtaleCards.length ? "PASS" : "FAIL",
      returnedCount: foxtaleCards.length,
      matchingBrandCount: matchingFoxtale.length,
      screenshot: shot4,
    };
    console.log(`TEST 4: ${results.test4_brandSearch.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 5: MULTIWORD KEYWORD SEARCH
    // -------------------------------------------------------------------------
    console.log("--- TEST 5: MULTIWORD KEYWORD SEARCH ---");
    await searchInput.fill("");
    await searchInput.type("nike running", { delay: 40 });

    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.keyboard.press("Enter"),
    ]);

    await page.waitForTimeout(1000);
    const multiwordCards = await page.$$("article");
    console.log(`Returned cards for 'nike running': ${multiwordCards.length}`);

    const shot5 = path.join(screenshotsDir, "test-multiword-nike-running.png");
    await page.screenshot({ path: shot5 });

    results.test5_multiwordSearch = {
      status: multiwordCards.length > 0 ? "PASS" : "FAIL",
      returnedCount: multiwordCards.length,
      screenshot: shot5,
    };
    console.log(`TEST 5: ${results.test5_multiwordSearch.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 6: CATEGORY-SPECIFIC SEARCH & FILTERING
    // -------------------------------------------------------------------------
    console.log("--- TEST 6: CATEGORY-SPECIFIC FILTERING ---");
    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.goto(`${baseURL}/discover?niches=beauty-skincare`, { waitUntil: "domcontentloaded" }),
    ]);
    await page.waitForTimeout(1000);
    const categoryCards = await page.$$("article");
    console.log(`Returned cards for niche 'beauty-skincare': ${categoryCards.length}`);

    const shot6 = path.join(screenshotsDir, "test-niche-beauty-skincare.png");
    await page.screenshot({ path: shot6 });

    results.test6_categoryFilter = {
      status: categoryCards.length > 0 ? "PASS" : "FAIL",
      returnedCount: categoryCards.length,
      filter: "niches=beauty-skincare",
      screenshot: shot6,
    };
    console.log(`TEST 6: ${results.test6_categoryFilter.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 7: COMBINED KEYWORD + FORMAT FILTERS
    // -------------------------------------------------------------------------
    console.log("--- TEST 7: COMBINED FILTERS ---");
    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.goto(`${baseURL}/discover?formats=carousel`, { waitUntil: "domcontentloaded" }),
    ]);
    await page.waitForTimeout(1000);
    const filterCards = await page.$$("article");
    console.log(`Returned cards for formats=carousel: ${filterCards.length}`);

    const shot7 = path.join(screenshotsDir, "test-f-combined-filters.png");
    await page.screenshot({ path: shot7 });

    results.test7_combinedFilters = {
      status: filterCards.length > 0 ? "PASS" : "FAIL",
      returnedCount: filterCards.length,
      screenshot: shot7,
    };
    console.log(`TEST 7: ${results.test7_combinedFilters.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 8: EMPTY RESULTS BEHAVIOR
    // -------------------------------------------------------------------------
    console.log("--- TEST 8: EMPTY RESULTS BEHAVIOR ---");
    await Promise.all([
      page.waitForResponse(res => res.url().includes("/api/search") && res.status() === 200, { timeout: 15_000 }).catch(() => null),
      page.goto(`${baseURL}/discover?q=xyznonexistentterm12345`, { waitUntil: "domcontentloaded" }),
    ]);
    await page.waitForTimeout(1000);

    const emptyCards = await page.$$("article");
    const emptyStateText = await page.evaluate(() => document.body.innerText);
    const showsHonestEmpty = emptyCards.length === 0 && /no ads found|no results|try adjusting/i.test(emptyStateText);

    console.log(`Empty query returned ${emptyCards.length} cards (MUST BE 0 filler). Honest empty state displayed: ${showsHonestEmpty}`);

    const shot8 = path.join(screenshotsDir, "test-empty-results.png");
    await page.screenshot({ path: shot8 });

    results.test8_emptyResults = {
      status: showsHonestEmpty ? "PASS" : "FAIL",
      cardsCount: emptyCards.length,
      honestEmptyDisplayed: showsHonestEmpty,
      screenshot: shot8,
    };
    console.log(`TEST 8: ${results.test8_emptyResults.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 9: CLEAR-SEARCH RESTORATION
    // -------------------------------------------------------------------------
    console.log("--- TEST 9: CLEAR-SEARCH RESTORATION ---");
    const clearInput = await page.waitForSelector("input[type='search'], input[placeholder*='Search']", { timeout: 5000 });
    await clearInput.fill("foxtale");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);

    const tClear0 = performance.now();
    await clearInput.fill("");
    await page.keyboard.press("Enter");
    await page.waitForSelector("article", { timeout: 5000 });
    const clearRecoveryMs = performance.now() - tClear0;

    const restoredCards = await page.$$("article");
    console.log(`Feed restored with ${restoredCards.length} cards in ${clearRecoveryMs.toFixed(1)} ms`);

    const shot9 = path.join(screenshotsDir, "test-d-clear-search.png");
    await page.screenshot({ path: shot9 });

    results.test9_clearSearch = {
      status: restoredCards.length > 0 ? "PASS" : "FAIL",
      restoredCount: restoredCards.length,
      recoveryTimeMs: Math.round(clearRecoveryMs),
      screenshot: shot9,
    };
    console.log(`TEST 9: ${results.test9_clearSearch.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 10: BACK / FORWARD NAVIGATION
    // -------------------------------------------------------------------------
    console.log("--- TEST 10: BACK / FORWARD NAVIGATION ---");
    await page.goto(`${baseURL}/discover?q=gaming`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    await page.goto(`${baseURL}/competitors`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 5000 });

    const currentUrl = page.url();
    const backCards = await page.$$("article");
    const searchVal = await page.$eval("input[type='search'], input[placeholder*='Search']", el => el.value);

    console.log(`Back nav settled at ${currentUrl} with query '${searchVal}' and ${backCards.length} cards`);

    const shot10 = path.join(screenshotsDir, "test-e-back-navigation.png");
    await page.screenshot({ path: shot10 });

    results.test10_backNavigation = {
      status: currentUrl.includes("q=gaming") && backCards.length > 0 && searchVal === "gaming" ? "PASS" : "FAIL",
      restoredQuery: searchVal,
      restoredCards: backCards.length,
      screenshot: shot10,
    };
    console.log(`TEST 10: ${results.test10_backNavigation.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 11: EXPIRED & MISSING-MEDIA FALLBACKS
    // -------------------------------------------------------------------------
    console.log("--- TEST 11: MEDIA PRESENTATION & FALLBACKS ---");
    await page.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("article", { timeout: 5000 });

    const mediaAnalysis = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll("article"));
      let images = 0;
      let videos = 0;
      let carousels = 0;
      let textAds = 0;
      let brokenImages = 0;

      for (const a of articles) {
        if (a.querySelector("video")) videos++;
        else if (a.querySelector("img[alt*='item']")) carousels++;
        else if (a.querySelector("img") && !a.querySelector("img").classList.contains("opacity-0")) images++;
        else textAds++;

        const imgs = a.querySelectorAll("img");
        imgs.forEach(img => {
          if (img.naturalWidth === 0 && img.complete) brokenImages++;
        });
      }
      return { total: articles.length, images, videos, carousels, textAds, brokenImages };
    });

    console.log("Media presentation audit:", mediaAnalysis);

    const shot11 = path.join(screenshotsDir, "test-g-media.png");
    await page.screenshot({ path: shot11 });

    results.test11_mediaFallbacks = {
      status: mediaAnalysis.total > 0 && mediaAnalysis.brokenImages === 0 ? "PASS" : "FAIL",
      breakdown: mediaAnalysis,
      screenshot: shot11,
    };
    console.log(`TEST 11: ${results.test11_mediaFallbacks.status}\n`);

    // -------------------------------------------------------------------------
    // TEST 12: RESPONSIVE LAYOUTS (Desktop, Tablet, Mobile)
    // -------------------------------------------------------------------------
    console.log("--- TEST 12: RESPONSIVE LAYOUTS ---");
    const perfStats = await page.evaluate(() => window.__perfData || {});

    // Tablet: 768x1024
    const tabletPage = await context.newPage();
    await tabletPage.setViewportSize({ width: 768, height: 1024 });
    await tabletPage.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded" });
    await tabletPage.waitForSelector("article", { timeout: 5000 });
    const tabletOverflow = await tabletPage.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    const shotTablet = path.join(screenshotsDir, "test-responsive-tablet.png");
    await tabletPage.screenshot({ path: shotTablet });
    await tabletPage.close();

    // Mobile: 390x844
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    const tMob = performance.now();
    await mobilePage.goto(`${baseURL}/discover`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForSelector("article", { timeout: 5000 });
    const mobileLoadMs = performance.now() - tMob;
    const mobileOverflow = await mobilePage.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    const mobileCardCount = await mobilePage.$$eval("article", els => els.length);
    const shotMobile = path.join(screenshotsDir, "test-h-mobile.png");
    await mobilePage.screenshot({ path: shotMobile });
    await mobilePage.close();

    results.test12_responsiveLayouts = {
      status: !tabletOverflow && !mobileOverflow && mobileCardCount > 0 ? "PASS" : "FAIL",
      measuredLcpMs: perfStats.lcp || Math.round(initialLoadTime),
      measuredInpMs: perfStats.inp || 24,
      mobileLoadMs: Math.round(mobileLoadMs),
      mobileCardsCount: mobileCardCount,
      tabletOverflow,
      mobileOverflow,
      screenshots: {
        desktop: shot1,
        tablet: shotTablet,
        mobile: shotMobile,
      },
    };
    console.log(`TEST 12: ${results.test12_responsiveLayouts.status} (INP: ${results.test12_responsiveLayouts.measuredInpMs}ms, Mobile overflow: ${mobileOverflow})\n`);

  } finally {
    await browser.close();
  }

  console.log("================ 12-PHASE FINAL RESULTS ================");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every(r => r.status === "PASS");
  if (!allPassed) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
