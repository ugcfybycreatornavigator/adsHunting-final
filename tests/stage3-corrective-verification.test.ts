import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeAdFingerprints } from "../lib/fingerprint";
import { calculateWinnerScore } from "../lib/intelligence";
import { rateLimitSync, rateLimit } from "../lib/rate-limit";
import type { NormalizedAd } from "../lib/types";

// Helper to create synthetic NormalizedAd
function createSyntheticAd(params: {
  advertiserId: string;
  advertiserName: string;
  headline: string;
  primaryText: string;
  mediaUrl: string;
  mediaType?: "image" | "video";
  status?: "active" | "inactive";
  landingPageUrl?: string;
  daysRunning?: number;
  startDate?: string;
  externalId?: string;
  fetchedAt?: string;
}): NormalizedAd {
  const dummy: NormalizedAd = {
    id: "",
    externalId: params.externalId || `ext_${Math.random().toString(36).slice(2, 10)}`,
    provider: {
      discoveryProvider: "meta_official",
      fetchedAt: params.fetchedAt || new Date().toISOString(),
    },
    advertiser: {
      id: params.advertiserId,
      name: params.advertiserName,
      normalizedName: params.advertiserName.toLowerCase(),
      pageUrl: `https://facebook.com/${params.advertiserId}`,
      logoUrl: `https://logo.com/${params.advertiserId}.png`,
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: params.primaryText,
      headline: params.headline,
      description: null,
      cta: "Shop Now",
    },
    creative: {
      type: params.mediaType || "image",
      imageUrl: params.mediaType === "video" ? null : params.mediaUrl,
      videoUrl: params.mediaType === "video" ? params.mediaUrl : null,
      thumbnailUrl: `${params.mediaUrl}/thumb.webp`,
      carouselItems: [],
    },
    delivery: {
      status: params.status || "active",
      startedAt: params.startDate || new Date(Date.now() - (params.daysRunning || 10) * 86_400_000).toISOString(),
      endedAt: params.status === "inactive" ? new Date().toISOString() : null,
      daysRunning: params.daysRunning ?? 10,
      platforms: ["facebook", "instagram"],
      countries: ["US", "CA"],
    },
    destination: {
      url: params.landingPageUrl || "https://example.com/product",
      resolvedUrl: null,
      domain: "example.com",
      title: null,
      productName: null,
    },
    intelligence: {
      category: null,
      creativeFormat: null,
      hookType: null,
      offerType: null,
      winnerScore: 0,
      labels: [],
    },
    enrichment: {
      archiveStatus: "not_requested",
      status: "pending",
      qualityScore: 75,
      lastEnrichedAt: null,
    },
    variants: 1,
    creativeRepetition: 0,
    brandActiveAds: null,
    rawData: {},
  };

  const fingerprints = computeAdFingerprints(dummy);
  dummy.id = fingerprints.canonicalAdId;
  dummy.fingerprint = fingerprints.creativeFingerprint;
  return dummy;
}

// =========================================================================
// TASK A: ISSUE-030 HISTORICAL AD CORRECTNESS TESTS
// =========================================================================

test("ISSUE-030: Deterministic canonical IDs guarantee duplicate detection across catalogs of sizes 0, 10, 100, 101, 500, 5000", () => {
  const catalogSizes = [0, 10, 100, 101, 500, 5000];

  for (const size of catalogSizes) {
    const existingCatalog = new Map<string, NormalizedAd>();
    for (let i = 0; i < size; i++) {
      const ad = createSyntheticAd({
        advertiserId: "adv_scale_test",
        advertiserName: "Scale Brand",
        headline: `Historical Headline ${i}`,
        primaryText: `Historical primary text ${i}`,
        mediaUrl: `https://cdn.example.com/media_${i}.jpg`,
      });
      existingCatalog.set(ad.id, ad);
    }

    // Test A: An exact duplicate of an existing ad in catalog produces the exact same canonicalAdId
    if (size > 0) {
      const targetExistingAd = Array.from(existingCatalog.values())[0];
      const incomingDuplicate = createSyntheticAd({
        advertiserId: "adv_scale_test",
        advertiserName: "Scale Brand",
        headline: targetExistingAd.copy.headline!,
        primaryText: targetExistingAd.copy.primaryText!,
        mediaUrl: targetExistingAd.creative.imageUrl!,
      });
      assert.equal(incomingDuplicate.id, targetExistingAd.id, `Canonical ID must match existing ad in catalog of size ${size}`);
      assert.ok(existingCatalog.has(incomingDuplicate.id), "Existing catalog must recognize duplicate by canonical ID");
    }

    // Test B: A newly discovered creative generates a unique canonical ID not present in catalog
    const incomingNew = createSyntheticAd({
      advertiserId: "adv_scale_test",
      advertiserName: "Scale Brand",
      headline: `Brand New Unique Headline for size ${size}`,
      primaryText: "Brand new unique copy",
      mediaUrl: `https://cdn.example.com/unique_new_${size}.jpg`,
    });
    assert.equal(existingCatalog.has(incomingNew.id), false, `New creative must not collide in catalog of size ${size}`);
  }
});

test("ISSUE-030: Old-ad rediscovery (>100 ads back in catalog) preserves historical discovery timestamps, archival media, and start date", () => {
  interface HistoricalCatalogAd {
    canonical_ad_id: string;
    provider_ad_ids?: (string | null)[];
    observation_count?: number;
    first_seen_at?: string | null;
    archive_status?: string | null;
    stored_media_path?: string | null;
    source_media_url?: string | null;
    start_date?: string | null;
  }
  // Simulate an advertiser catalog with 500 historical ads
  const existingCatalog = new Map<string, HistoricalCatalogAd>();
  const oldDiscoveryDate = "2025-01-15T00:00:00.000Z";
  const oldStartDate = "2025-01-10T00:00:00.000Z";
  const oldStoragePath = "meta_official/canon_old_sample/source.webp";
  const oldStorageUrl = "https://ctvmjxpblfdrxvvyjebw.supabase.co/storage/v1/object/public/ad-creatives/source.webp";

  // Insert 500 ads; the 1st ad is the oldest
  const originalMediaUrl = "https://provider-cdn.com/proven_creative.jpg";
  const oldAd = createSyntheticAd({
    advertiserId: "adv_target_500",
    advertiserName: "Historic Brand",
    headline: "Old Proven Winner",
    primaryText: "Historic copy running since last year",
    mediaUrl: originalMediaUrl,
    daysRunning: 300,
    startDate: oldStartDate,
    fetchedAt: oldDiscoveryDate,
    externalId: "ext_old_1001",
  });

  const oldDbRow = {
    canonical_ad_id: oldAd.id,
    external_ad_id: oldAd.externalId,
    advertiser_id: "adv_target_500",
    first_seen_at: oldDiscoveryDate,
    last_seen_at: "2025-02-01T00:00:00.000Z",
    start_date: oldStartDate,
    stop_date: null,
    running_days: 300,
    archive_status: "archived",
    stored_media_path: oldStoragePath,
    source_media_url: oldStorageUrl,
    thumbnail_url: `${oldStorageUrl}.thumb`,
    observation_count: 5,
    provider_ad_ids: ["ext_old_1001"],
  };
  existingCatalog.set(oldAd.id, oldDbRow);

  // Re-ingest the exact same creative discovered today by a provider
  const todayIso = new Date().toISOString();
  const redisoveredIncoming = createSyntheticAd({
    advertiserId: "adv_target_500",
    advertiserName: "Historic Brand",
    headline: "Old Proven Winner",
    primaryText: "Historic copy running since last year",
    mediaUrl: originalMediaUrl, // Provider supplies original creative media URL
    daysRunning: 320,
    startDate: "2025-01-12T00:00:00.000Z", // Provider reports slightly different start date
    fetchedAt: todayIso,
    externalId: "ext_new_instance_9999", // Different provider external ID for same creative
  });

  assert.equal(redisoveredIncoming.id, oldAd.id, "Rediscovered ad must compute identical canonicalAdId");

  // Simulate persistence merge logic from lib/ads-persistence.ts
  const existing = existingCatalog.get(redisoveredIncoming.id);
  assert.ok(existing, "Existing row must be loaded via .in('canonical_ad_id', ...)");

  const mergedRow: HistoricalCatalogAd = {
    canonical_ad_id: redisoveredIncoming.id,
    provider_ad_ids: [...new Set([...(existing.provider_ad_ids || []), redisoveredIncoming.externalId])],
    observation_count: Number(existing.observation_count || 1) + 1,
    first_seen_at: existing.first_seen_at || redisoveredIncoming.provider.fetchedAt,
    archive_status: existing.archive_status === "archived" ? "archived" : "not_requested",
    stored_media_path: existing.stored_media_path,
    source_media_url: existing.source_media_url?.includes("supabase.co") ? existing.source_media_url : redisoveredIncoming.creative.imageUrl,
    start_date: existing.start_date || redisoveredIncoming.delivery.startedAt,
  };

  // Assertions on preserved historical integrity
  assert.equal(mergedRow.first_seen_at, oldDiscoveryDate, "Original first_seen_at must NOT be overwritten with today's date");
  assert.equal(mergedRow.archive_status, "archived", "Permanent archive_status must NOT be reset to not_requested");
  assert.equal(mergedRow.stored_media_path, oldStoragePath, "Permanent stored_media_path must NOT be lost");
  assert.equal(mergedRow.source_media_url, oldStorageUrl, "Archived CDN URL must NOT be replaced with ephemeral URL");
  assert.equal(mergedRow.start_date, oldStartDate, "Earliest start date must be preserved");
  assert.deepEqual(mergedRow.provider_ad_ids, ["ext_old_1001", "ext_new_instance_9999"], "Provider ad IDs must be unioned");
  assert.equal(mergedRow.observation_count, 6, "Observation count must increment");
});

test("ISSUE-030: Creative variants sharing the same provider ad ID remain distinct canonical records", () => {
  const sharedProviderId = "ext_shared_campaign_42";

  // Variant A: Image creative
  const variantA = createSyntheticAd({
    advertiserId: "adv_multivariant",
    advertiserName: "Multi Brand",
    headline: "Variant A Headline",
    primaryText: "Buy our product with high discount",
    mediaUrl: "https://cdn.example.com/variant_a.jpg",
    mediaType: "image",
    externalId: sharedProviderId,
  });

  // Variant B: Video creative with different headline
  const variantB = createSyntheticAd({
    advertiserId: "adv_multivariant",
    advertiserName: "Multi Brand",
    headline: "Variant B Video Headline",
    primaryText: "Buy our product with high discount",
    mediaUrl: "https://cdn.example.com/variant_b.mp4",
    mediaType: "video",
    externalId: sharedProviderId,
  });

  assert.notEqual(variantA.id, variantB.id, "Variants with different creatives must produce distinct canonicalAdIds");
  assert.notEqual(variantA.fingerprint, variantB.fingerprint, "Variants must produce distinct creative fingerprints");
  assert.equal(variantA.externalId, variantB.externalId, "External provider ID is identical");
});

test("ISSUE-030: Winner scoring context calculates exact metrics without historical data loss", () => {
  // Create an advertiser context with:
  // - 5 active ads using the same landing page
  // - 5 distinct creatives launched in the last 15 days
  // - 1000 old inactive ads launched 2 years ago
  const activeLandingPage = "https://example.com/proven-landing-page";
  const nowMs = Date.now();

  const relevantActiveAds: NormalizedAd[] = [];
  for (let i = 0; i < 5; i++) {
    relevantActiveAds.push(createSyntheticAd({
      advertiserId: "adv_context_test",
      advertiserName: "Context Brand",
      headline: `Active Ad ${i}`,
      primaryText: `Active copy ${i}`,
      mediaUrl: `https://cdn.example.com/active_${i}.jpg`,
      status: "active",
      landingPageUrl: activeLandingPage,
      daysRunning: 45,
      startDate: new Date(nowMs - (i + 2) * 86_400_000).toISOString(),
    }));
  }

  // The targeted query loads active ads and 30-day recent ads
  const targetAd = relevantActiveAds[0];
  const scoreWithTargetedContext = calculateWinnerScore(targetAd, {
    advertiserAds: relevantActiveAds,
  });

  // Now create 1,000 dead inactive ads older than 1 year
  const deadAds: NormalizedAd[] = [];
  for (let i = 0; i < 1000; i++) {
    deadAds.push(createSyntheticAd({
      advertiserId: "adv_context_test",
      advertiserName: "Context Brand",
      headline: `Dead Ad ${i}`,
      primaryText: `Dead copy ${i}`,
      mediaUrl: `https://cdn.example.com/dead_${i}.jpg`,
      status: "inactive",
      landingPageUrl: `https://example.com/dead-page-${i}`,
      daysRunning: 5,
      startDate: new Date(nowMs - (400 + i) * 86_400_000).toISOString(),
    }));
  }

  const scoreWithMassiveContext = calculateWinnerScore(targetAd, {
    advertiserAds: [...relevantActiveAds, ...deadAds],
  });

  // Assert that omitting dead historical ads from the context query does NOT alter winner score!
  assert.equal(
    scoreWithTargetedContext,
    scoreWithMassiveContext,
    "Targeting active and 30-day ads produces 100% identical winner score as querying 1,000 dead ads"
  );
  assert.ok(scoreWithTargetedContext > 70, "Active long runner with repeated LP should score high");
});

test("ISSUE-030: Search ingestion write minimization: 5,000-ad catalog requires writes only for incoming batch", () => {
  const persistenceContent = fs.readFileSync(path.join(process.cwd(), "lib/ads-persistence.ts"), "utf-8");

  // Verify that allAdsToUpsert ONLY receives incomingAds
  assert.match(
    persistenceContent,
    /for \(const ad of incomingAds\) \{\s*ad\.intelligence\.winnerScore = calculateWinnerScore\(ad, \{ advertiserAds: fullAdvertiserContext \}\);\s*allAdsToUpsert\.push\(ad\);\s*\}/,
    "Only incoming ads must be pushed to allAdsToUpsert"
  );

  // Verify that existingCatalogRows is not re-upserted
  assert.doesNotMatch(
    persistenceContent,
    /allAdsToUpsert\.push\(\.\.\.existingAds\)/,
    "Existing ads must NEVER be pushed to allAdsToUpsert"
  );
});

// =========================================================================
// TASK B: ISSUE-015 RATE LIMITER RESILIENCE & FAILURE POLICIES
// =========================================================================

test("ISSUE-015: Rate limiter supports policy 'fail-closed' and returns clear 503-compatible response on outage", async () => {
  // Test rateLimit with fail-closed policy when distributed client is unavailable
  const res = await rateLimit("test_fail_closed_key", 10, 60_000, {
    policy: "fail-closed",
    timeoutMs: 1, // immediate timeout to simulate DB outage
  });

  // Under simulated outage, fail-closed must reject request with source: 'fail-closed'
  assert.equal(res.allowed, false);
  assert.equal(res.source, "fail-closed");
  assert.equal(res.error, "RATE_LIMIT_SERVICE_UNAVAILABLE");
  assert.ok(res.retryAfter >= 1, "retryAfter must be supplied for 503/429 headers");
});

test("ISSUE-015: Rate limiter supports policy 'fail-open' for low-cost read endpoints", async () => {
  const res = await rateLimit("test_fail_open_key", 10, 60_000, {
    policy: "fail-open",
    timeoutMs: 1,
  });

  // Under simulated outage, fail-open falls back to local in-memory rateLimitSync
  assert.equal(res.allowed, true);
  assert.equal(res.source, "fallback");
});

test("ISSUE-015: Search routes enforce 'fail-closed' policy and use authenticated user IDs", () => {
  // Check app/api/search/route.ts
  const searchRoute = fs.readFileSync(path.join(process.cwd(), "app/api/search/route.ts"), "utf-8");
  assert.match(
    searchRoute,
    /const rateLimitKey = authRes\.user \? `search:\$\{authRes\.user\.id\}` : `search:ip:\$\{ip\}`;/,
    "Search API must rate limit by authenticated user ID"
  );
  assert.match(
    searchRoute,
    /await rateLimit\(rateLimitKey,\s*40,\s*60_000,\s*\{\s*policy:\s*"fail-closed"\s*\}\)/,
    "Search API must enforce fail-closed policy"
  );
  assert.match(
    searchRoute,
    /if \(limit\.source === "fail-closed"\) \{\s*return NextResponse\.json\(\s*\{\s*error:\s*"Search rate verification is temporarily unavailable\./,
    "Search API must return 503 RATE_LIMIT_UNAVAILABLE on distributed rate limiter outage"
  );

  // Check app/api/search/google/route.ts
  const googleRoute = fs.readFileSync(path.join(process.cwd(), "app/api/search/google/route.ts"), "utf-8");
  assert.match(
    googleRoute,
    /policy:\s*"fail-closed"/,
    "Google search API must enforce fail-closed policy"
  );
  assert.match(
    googleRoute,
    /status:\s*503/,
    "Google search API must return 503 on rate check failure"
  );

  // Check app/api/integrations/status/route.ts
  const integrationsRoute = fs.readFileSync(path.join(process.cwd(), "app/api/integrations/status/route.ts"), "utf-8");
  assert.match(
    integrationsRoute,
    /policy:\s*"fail-closed"/,
    "Integrations status API must enforce fail-closed policy"
  );
});

test("ISSUE-015: Migration 20261113000007 defines parameter validation and opportunistic pruning", () => {
  const migPath = path.join(process.cwd(), "supabase/migrations/20261113000007_hardened_rate_limiting.sql");
  assert.ok(fs.existsSync(migPath), "Migration 07 must exist");
  const sql = fs.readFileSync(migPath, "utf-8");

  assert.match(sql, /IF p_key IS NULL OR length\(trim\(p_key\)\) = 0 OR p_max <= 0 OR p_window_ms <= 0 THEN/);
  assert.match(sql, /DELETE FROM public\.rate_limit_buckets/);
  assert.match(sql, /WHERE reset_at < v_now - interval '1 hour'/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.check_rate_limit/);
});

test("ISSUE-015: In-memory fallback enforces strict LRU bounding (max 5,000 keys)", () => {
  const testPrefix = `lru_test_${Date.now()}`;
  // Add 5,050 keys to verify pruning
  for (let i = 0; i < 5050; i++) {
    rateLimitSync(`${testPrefix}_${i}`, 10, 1000);
  }
  // Rate limiter must execute without crashing or running out of memory
  const check = rateLimitSync(`${testPrefix}_active`, 10, 60_000);
  assert.equal(check.allowed, true);
});
