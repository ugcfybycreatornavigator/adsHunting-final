import { dbAdToNormalized } from "../lib/catalog";
import type { DatabaseAdRow } from "../lib/catalog";
import { resolveAdMedia } from "../lib/media";
import { sanitizeAdCopy } from "../lib/utils";

// Benchmark data structures simulating production ad batches
function createSyntheticAd(i: number): DatabaseAdRow {
  return {
    id: `ad_${i}`,
    canonical_ad_id: `canon_${i}`,
    external_ad_id: `ext_${i}`,
    advertiser_id: `adv_${i % 15}`,
    advertiser_name: `Brand ${i % 15}`,
    advertiser_avatar_url: `https://example.com/avatar_${i % 15}.png`,
    advertiser_profile_url: `https://facebook.com/brand_${i % 15}`,
    body: `Discover the best deals on high performance footwear #${i}. Exclusive discount for limited time only!`,
    headline: `Brand ${i % 15} - Running Performance Redefined #${i}`,
    description: `Official store description with fast shipping and 30-day money back guarantee #${i}`,
    cta: i % 2 === 0 ? "Shop Now" : "Learn More",
    landing_page_url: `https://example.com/products/shoe_${i}`,
    source_media_url: i % 3 === 0 ? `https://example.com/video_${i}.mp4` : `https://example.com/image_${i}.jpg`,
    thumbnail_url: `https://example.com/thumb_${i}.jpg`,
    stored_media_path: null,
    media_type: i % 3 === 0 ? "video" : i % 5 === 0 ? "carousel" : "image",
    status: "active",
    start_date: "2026-10-01T00:00:00Z",
    stop_date: null,
    first_seen_at: "2026-10-01T00:00:00Z",
    last_seen_at: "2026-11-14T00:00:00Z",
    missing_checks: 0,
    running_days: 45,
    country: "US",
    platforms: ["facebook", "instagram"],
    snapshot_url: null,
    source: "meta_official",
    variant_key: undefined,
    raw_data: { tracking: "unbounded_payload_simulated", details: new Array(20).fill("extra_meta_field") },
    refined_data: null,
    carousel_assets: i % 5 === 0 ? [`https://example.com/c1_${i}.jpg`, `https://example.com/c2_${i}.jpg`] : [],
    quality_score: 85,
  };
}

async function runBenchmark() {
  console.log("=== ADSHUNTING PERFORMANCE BENCHMARK ===");
  const batch60 = Array.from({ length: 60 }, (_, i) => createSyntheticAd(i));

  // 1. Serialization & Normalization Cost (60 rows)
  const t0 = performance.now();
  const iterations = 100;
  for (let iter = 0; iter < iterations; iter++) {
    const normalized = batch60.map(dbAdToNormalized);
    for (const ad of normalized) {
      resolveAdMedia(ad);
      sanitizeAdCopy(ad.copy.headline);
      sanitizeAdCopy(ad.copy.primaryText);
    }
  }
  const avgNormalizationMs = (performance.now() - t0) / iterations;
  console.log(`[Baseline] 60-ad batch normalization + media resolution: ${avgNormalizationMs.toFixed(3)} ms`);

  // 2. Main-Thread Render Simulation
  // Simulating 30 card re-renders during keystroke
  const t1 = performance.now();
  for (let iter = 0; iter < 100; iter++) {
    const subset = batch60.slice(0, 30).map(dbAdToNormalized);
    for (const ad of subset) {
      // simulate unmemoized card work
      resolveAdMedia(ad);
      sanitizeAdCopy(ad.copy.headline);
      sanitizeAdCopy(ad.copy.primaryText);
      sanitizeAdCopy(ad.copy.description);
      const url = ad.destination.url ? new URL(ad.destination.url).hostname : "";
      void url;
    }
  }
  const avgKeystrokeCostMs = (performance.now() - t1) / 100;
  console.log(`[Baseline] Unmemoized 30-card keystroke computation cost: ${avgKeystrokeCostMs.toFixed(3)} ms`);

  // 3. Payload size comparison: SELECT * vs Selected Columns
  const fullRowJson = JSON.stringify(batch60[0]);
  const trimmedRow: Partial<DatabaseAdRow> = { ...batch60[0] };
  delete trimmedRow.raw_data;
  delete trimmedRow.transcript_data;
  delete trimmedRow.creative_analysis;
  const trimmedRowJson = JSON.stringify(trimmedRow);

  console.log(`[Baseline] Full row size: ${Buffer.byteLength(fullRowJson)} bytes`);
  console.log(`[Optimized] Trimmed row size: ${Buffer.byteLength(trimmedRowJson)} bytes`);
  console.log(`[Savings] Payload reduction per row: ${(((Buffer.byteLength(fullRowJson) - Buffer.byteLength(trimmedRowJson)) / Buffer.byteLength(fullRowJson)) * 100).toFixed(1)}%`);
}

runBenchmark().catch(console.error);
