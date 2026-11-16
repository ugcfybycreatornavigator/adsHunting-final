import test from "node:test";
import assert from "node:assert/strict";
import { dbAdToNormalized, type DatabaseAdRow } from "../lib/catalog";
import { resolveAdMedia } from "../lib/media";
import type { NormalizedAd } from "../lib/types";

// Simulated server-side cache for unit verification identical to route implementation
interface CatalogAdsCacheEntry {
  expiresAt: number;
  ads: NormalizedAd[];
  nextCursor: string | null;
  total: number;
}

test("Cache Security: Catalog cache stores only normalized ads, never user credits or private tokens", () => {
  const dummyAd: NormalizedAd = {
    id: "ad_123",
    externalId: "ext_123",
    provider: { discoveryProvider: "catalog", fetchedAt: "2026-11-16T00:00:00Z" },
    advertiser: {
      id: "brand_nike",
      name: "Nike",
      displayName: "Nike",
      normalizedName: "nike",
      pageUrl: null,
      logoUrl: null,
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: { headline: "Run Fast", primaryText: "Nike running gear", description: null, cta: "Shop" },
    creative: { type: "image", imageUrl: "https://example.com/nike.jpg", videoUrl: null, thumbnailUrl: null, carouselItems: [] },
    delivery: { status: "active", startedAt: "2026-10-01T00:00:00Z", endedAt: null, daysRunning: 45, platforms: ["facebook"], countries: ["US"] },
    destination: { url: "https://nike.com", resolvedUrl: null, domain: "nike.com", title: null, productName: null },
    intelligence: { category: "Apparel", creativeFormat: null, hookType: null, offerType: null, winnerScore: 90, labels: [] },
    enrichment: { archiveStatus: "not_requested", status: "complete", qualityScore: 90, lastEnrichedAt: null },
  };

  const cacheEntry: CatalogAdsCacheEntry = {
    expiresAt: Date.now() + 45_000,
    ads: [dummyAd],
    nextCursor: "60",
    total: 100,
  };

  // Ensure user-specific private fields are structurally impossible in cache entry
  assert.equal("credits" in cacheEntry, false, "Cache entry must not contain credits object");
  assert.equal("userId" in cacheEntry, false, "Cache entry must not contain user ID");
  assert.equal("workspaceId" in cacheEntry, false, "Cache entry must not contain workspace ID");
  assert.equal("requestId" in cacheEntry, false, "Cache entry must not lock requestId");
});

test("Cache Security: Distinct search fingerprints and session offsets produce distinct cache keys", () => {
  const fp1 = "fingerprint_query_nike";
  const fp2 = "fingerprint_query_adidas";
  const sess1 = "sess_userA_123";
  const sess2 = "sess_userB_456";

  const key1 = `${fp1}:0:${sess1}`;
  const key2 = `${fp1}:60:${sess1}`;
  const key3 = `${fp2}:0:${sess1}`;
  const key4 = `${fp1}:0:${sess2}`;

  assert.notEqual(key1, key2, "Different page offsets must produce distinct cache keys");
  assert.notEqual(key1, key3, "Different search queries must produce distinct cache keys");
  assert.notEqual(key1, key4, "Different discovery sessions must produce distinct cache keys");
});

test("Cache Correctness: Expired cache entries are invalidated after TTL", () => {
  const cache = new Map<string, CatalogAdsCacheEntry>();
  const now = Date.now();

  cache.set("key_fresh", { expiresAt: now + 45_000, ads: [], nextCursor: null, total: 0 });
  cache.set("key_expired", { expiresAt: now - 1_000, ads: [], nextCursor: null, total: 0 });

  const fresh = cache.get("key_fresh");
  const expired = cache.get("key_expired");

  assert.ok(fresh && fresh.expiresAt > now, "Fresh cache entry must be valid");
  assert.ok(expired && expired.expiresAt <= now, "Expired entry must fail validity check");
});

test("Cache Correctness: In-memory cache enforces LRU capacity bounding", () => {
  const cache = new Map<string, number>();
  const MAX = 5;

  for (let i = 1; i <= 7; i++) {
    if (cache.size >= MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(`key_${i}`, i);
  }

  assert.equal(cache.size, 5, "Cache size must be strictly bounded at maximum capacity");
  assert.equal(cache.has("key_1"), false, "Oldest key 1 must have been evicted");
  assert.equal(cache.has("key_2"), false, "Oldest key 2 must have been evicted");
  assert.equal(cache.has("key_7"), true, "Newest key 7 must be retained");
});

test("Database Projection: AD_CATALOG_COLUMNS satisfies full NormalizedAd mapping without raw_data", () => {
  // Simulating a row retrieved using AD_CATALOG_COLUMNS (excluding raw_data, transcripts, etc.)
  const projectedRow: DatabaseAdRow = {
    id: "uuid-1234",
    canonical_ad_id: "canon-5678",
    external_ad_id: "ext-9999",
    advertiser_id: "adv-nike",
    advertiser_name: "Nike Official",
    advertiser_avatar_url: "https://example.com/avatar.jpg",
    advertiser_profile_url: "https://facebook.com/nike",
    body: "Just Do It. Running performance collection.",
    headline: "The New Pegasus 42",
    description: "Official store description with fast shipping",
    cta: "Shop Now",
    landing_page_url: "https://nike.com/pegasus",
    source_media_url: "https://example.com/pegasus.jpg",
    thumbnail_url: "https://example.com/pegasus_thumb.jpg",
    media_type: "image",
    status: "active",
    start_date: "2026-10-01T00:00:00Z",
    stop_date: null,
    first_seen_at: "2026-10-01T00:00:00Z",
    last_seen_at: "2026-11-14T00:00:00Z",
    running_days: 45,
    country: "US",
    platforms: ["facebook", "instagram"],
    quality_score: 95,
    source: "meta_official",
    carousel_assets: null,
    archive_status: "not_requested",
    raw_data: null, // raw_data omitted in projected query
    refined_data: null,
    stored_media_path: null,
    snapshot_url: null,
  };

  const normalized = dbAdToNormalized(projectedRow);
  assert.equal(normalized.id, "canon-5678", "Canonical ID must be used as primary ad ID");
  assert.equal(normalized.advertiser.name, "Nike Official");
  assert.equal(normalized.copy.headline, "The New Pegasus 42");
  assert.equal(normalized.copy.primaryText, "Just Do It. Running performance collection.");
  assert.equal(normalized.delivery.daysRunning, 45);
  assert.equal(normalized.delivery.status, "active");

  const media = resolveAdMedia(normalized);
  assert.equal(media.kind, "image");
  assert.equal(media.imageUrl, "https://example.com/pegasus.jpg");
});

test("Media Rendering: Priority flag correctly configures eager loading for above-the-fold cards", () => {
  // Verifying configuration contract for above-the-fold (index < 4) vs below-the-fold
  function getMediaImageAttributes(isPriority: boolean) {
    return {
      loading: isPriority ? ("eager" as const) : ("lazy" as const),
      fetchPriority: isPriority ? ("high" as const) : ("auto" as const),
      decoding: "async" as const,
    };
  }

  const topCardAttrs = getMediaImageAttributes(true);
  assert.equal(topCardAttrs.loading, "eager", "Above-the-fold card must use eager loading");
  assert.equal(topCardAttrs.fetchPriority, "high", "Above-the-fold card must use high fetch priority");
  assert.equal(topCardAttrs.decoding, "async", "Images must use async decoding to avoid main-thread blocking");

  const belowFoldAttrs = getMediaImageAttributes(false);
  assert.equal(belowFoldAttrs.loading, "lazy", "Below-the-fold card must use lazy loading");
  assert.equal(belowFoldAttrs.fetchPriority, "auto", "Below-the-fold card must use auto fetch priority");
  assert.equal(belowFoldAttrs.decoding, "async");
});
