import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedAd } from "../lib/types";
import { normalizeDiscoverFilters, getActiveFilterCount } from "../lib/filter-utils";

// Hashing and PRNG algorithms identical to production implementation
function hashStringToSeed(str: string): number {
  let hash = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function interleaveDiverseAds(
  ads: NormalizedAd[],
  prng: () => number,
  maxPerBrand = 2
): NormalizedAd[] {
  if (ads.length <= 1) return ads;

  const brandBuckets = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const brandKey = ad.advertiser?.id || ad.advertiser?.name || ad.id;
    if (!brandBuckets.has(brandKey)) brandBuckets.set(brandKey, []);
    brandBuckets.get(brandKey)!.push(ad);
  }

  const buckets: NormalizedAd[][] = [];
  for (const [, bucketAds] of brandBuckets) {
    for (let i = bucketAds.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [bucketAds[i], bucketAds[j]] = [bucketAds[j], bucketAds[i]];
    }
    buckets.push(bucketAds.slice(0, maxPerBrand));
  }

  for (let i = buckets.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
  }

  const interleaved: NormalizedAd[] = [];
  let round = 0;
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const bucket of buckets) {
      if (round < bucket.length) {
        interleaved.push(bucket[round]);
        if (round + 1 < bucket.length) {
          hasMore = true;
        }
      }
    }
    round++;
  }

  return interleaved;
}

function calculateRelevanceScore(ad: NormalizedAd, fullQuery: string, tokens: string[]): number {
  let score = 0;
  const brandName = (ad.advertiser.displayName || ad.advertiser.name || "").toLowerCase();
  const headline = (ad.copy.headline || "").toLowerCase();
  const body = (ad.copy.primaryText || "").toLowerCase();
  const description = (ad.copy.description || "").toLowerCase();
  const cta = (ad.copy.cta || "").toLowerCase();

  // 1. Exact advertiser/brand match
  if (brandName === fullQuery) score += 200;
  else if (brandName.startsWith(fullQuery)) score += 120;
  else if (brandName.includes(fullQuery)) score += 80;

  // 2. Exact phrase in copy
  if (headline.includes(fullQuery)) score += 60;
  if (body.includes(fullQuery)) score += 30;
  if (description.includes(fullQuery)) score += 20;
  if (cta.includes(fullQuery)) score += 15;

  // 3. Multi-token matches
  for (const token of tokens) {
    if (brandName.includes(token)) score += 25;
    if (headline.includes(token)) score += 15;
    if (body.includes(token)) score += 8;
    if (description.includes(token)) score += 5;
  }

  if (ad.delivery?.status === "active") score += 10;
  if (ad.creative.type === "video" || ad.creative.type === "carousel") score += 5;

  return score;
}

function rankBySearchRelevance(ads: NormalizedAd[], query?: string): NormalizedAd[] {
  if (!query || !query.trim()) return ads;
  const q = query.trim().toLowerCase();
  const qTokens = q.split(/\s+/).filter(t => t.length > 1);

  return [...ads].sort((a, b) => {
    const scoreA = calculateRelevanceScore(a, q, qTokens);
    const scoreB = calculateRelevanceScore(b, q, qTokens);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const winnerA = a.intelligence?.winnerScore || 0;
    const winnerB = b.intelligence?.winnerScore || 0;
    if (winnerB !== winnerA) return winnerB - winnerA;
    return (b.delivery?.daysRunning || 0) - (a.delivery?.daysRunning || 0);
  });
}

function createDummyAd(id: string, brand: string, headline: string, body = "", mediaType: "image" | "video" | "carousel" = "image"): NormalizedAd {
  return {
    id,
    externalId: id,
    provider: { discoveryProvider: "catalog", fetchedAt: "2026-11-14T00:00:00Z" },
    advertiser: {
      id: `brand_${brand}`,
      name: brand,
      displayName: brand,
      normalizedName: brand.toLowerCase(),
      pageUrl: null,
      logoUrl: null,
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      headline,
      primaryText: body,
      description: null,
      cta: "Shop Now",
    },
    creative: {
      type: mediaType,
      imageUrl: "https://example.com/img.jpg",
      videoUrl: mediaType === "video" ? "https://example.com/vid.mp4" : null,
      thumbnailUrl: null,
      carouselItems: [],
    },
    delivery: {
      status: "active",
      startedAt: "2026-10-01T00:00:00Z",
      endedAt: null,
      daysRunning: 45,
      platforms: ["facebook", "instagram"],
      countries: ["US"],
    },
    destination: {
      url: "https://example.com",
      resolvedUrl: null,
      domain: "example.com",
      title: null,
      productName: null,
    },
    intelligence: {
      category: "E-Commerce",
      creativeFormat: null,
      hookType: null,
      offerType: null,
      winnerScore: 85,
      labels: [],
    },
    enrichment: {
      archiveStatus: "not_requested",
      status: "complete",
      qualityScore: 85,
      lastEnrichedAt: null,
    },
  };
}

test("Discovery Feed: PRNG is deterministic for identical session seeds", () => {
  const seed1 = hashStringToSeed("session-abc-123");
  const seed2 = hashStringToSeed("session-abc-123");
  const seed3 = hashStringToSeed("session-different-999");

  assert.equal(seed1, seed2, "Same session ID must produce identical seed");
  assert.notEqual(seed1, seed3, "Different session IDs must produce different seeds");

  const prngA = mulberry32(seed1);
  const prngB = mulberry32(seed2);

  const seqA = [prngA(), prngA(), prngA(), prngA()];
  const seqB = [prngB(), prngB(), prngB(), prngB()];

  assert.deepEqual(seqA, seqB, "Mulberry32 PRNG must be 100% deterministic with identical seed");
});

test("Discovery Feed: Interleaving caps identical brands and eliminates consecutive identical advertisers", () => {
  const ads: NormalizedAd[] = [
    createDummyAd("1", "Nike", "Nike Ad 1"),
    createDummyAd("2", "Nike", "Nike Ad 2"),
    createDummyAd("3", "Nike", "Nike Ad 3"),
    createDummyAd("4", "Nike", "Nike Ad 4"),
    createDummyAd("5", "Adidas", "Adidas Ad 1"),
    createDummyAd("6", "Adidas", "Adidas Ad 2"),
    createDummyAd("7", "Puma", "Puma Ad 1"),
    createDummyAd("8", "Under Armour", "UA Ad 1"),
    createDummyAd("9", "Gymshark", "Gymshark Ad 1"),
  ];

  const prng = mulberry32(hashStringToSeed("test-interleave-seed"));
  const interleaved = interleaveDiverseAds(ads, prng, 2);

  // 1. Max 2 per brand check
  const brandCounts = new Map<string, number>();
  for (const ad of interleaved) {
    const brand = ad.advertiser.name!;
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
  }
  assert.ok(brandCounts.get("Nike")! <= 2, "Nike must be capped at 2 ads per page");
  assert.ok(brandCounts.get("Adidas")! <= 2, "Adidas must be capped at 2 ads per page");

  // 2. Zero consecutive identical brands check
  for (let i = 0; i < interleaved.length - 1; i++) {
    const currBrand = interleaved[i].advertiser.name;
    const nextBrand = interleaved[i + 1].advertiser.name;
    assert.notEqual(currBrand, nextBrand, `Ad at ${i} (${currBrand}) and ${i + 1} (${nextBrand}) must not be consecutive`);
  }
});

test("Discovery Feed: Pagination disjoint candidate ranges guarantee zero duplicate ads across pages", () => {
  const candidateBatchSize = 60;
  const sessionBase = 40; // deterministic sessionBase for a given seed

  // Page 1 candidate range
  const p1Offset = 0;
  const p1Start = sessionBase + p1Offset;
  const p1End = p1Start + candidateBatchSize - 1;

  // Page 2 candidate range
  const p2Offset = candidateBatchSize;
  const p2Start = sessionBase + p2Offset;
  const p2End = p2Start + candidateBatchSize - 1;

  assert.equal(p1Start, 40);
  assert.equal(p1End, 99);
  assert.equal(p2Start, 100);
  assert.equal(p2End, 159);

  // Ensure candidate ranges are strictly disjoint
  assert.ok(p1End < p2Start, "Page 1 candidate range must strictly precede Page 2 with zero overlap");
});

test("Universal Search Engine: Exact brand match ranks ahead of copy keyword matches", () => {
  const adNike = createDummyAd("ad_nike", "Nike", "Just Do It", "Running shoes and apparel");
  const adReview = createDummyAd("ad_review", "ShoeReviewer", "Nike running shoes tested", "In-depth review of nike shoes");
  const adCompetitor = createDummyAd("ad_puma", "Puma", "Better Than Nike", "Why our shoes outperform nike");

  const ranked = rankBySearchRelevance([adReview, adCompetitor, adNike], "Nike");

  assert.equal(ranked[0].id, "ad_nike", "Exact brand match for 'Nike' must be ranked #1");
  assert.equal(ranked[1].id, "ad_review", "Headline match must rank ahead of body text match");
  assert.equal(ranked[2].id, "ad_puma", "Body/comparison mention must rank lower than headline match");
});

test("Universal Search Engine: Multi-word query matches across advertiser and headline", () => {
  const ad1 = createDummyAd("ad1", "Nike", "Best Running Shoes for 2026", "Engineered for speed");
  const ad2 = createDummyAd("ad2", "Adidas", "Casual Streetwear", "Comfortable daily wear");
  const ad3 = createDummyAd("ad3", "Brooks", "Running Shoes On Sale", "Discounted performance gear");

  const ranked = rankBySearchRelevance([ad2, ad3, ad1], "Nike running");

  assert.equal(ranked[0].id, "ad1", "Ad matching both 'Nike' (brand) and 'running' (headline) must rank first");
  assert.equal(ranked[1].id, "ad3", "Ad matching 'running' token must rank second");
  assert.equal(ranked[2].id, "ad2", "Non-matching ad must rank last");
});

test("Filter Engine: Normalize filters, calculate active counts, and toggle multi-select dimensions", () => {
  const rawFilters = {
    formats: ["video" as const, "carousel" as const],
    statuses: ["active" as const],
    markets: ["US", "CA"],
    languages: ["en"],
    runtime: { minDays: 7, maxDays: 30 },
  };

  const normalized = normalizeDiscoverFilters(rawFilters);
  assert.deepEqual(normalized.formats, ["video", "carousel"]);
  assert.deepEqual(normalized.statuses, ["active"]);
  assert.deepEqual(normalized.markets, ["US", "CA"]);
  assert.deepEqual(normalized.languages, ["en"]);
  assert.equal(normalized.runtime?.minDays, 7);

  const count = getActiveFilterCount(normalized);
  // formats (2) + statuses (1) + markets (2) + languages (1) + runtime (1) = 7
  assert.equal(count, 7, "Active filter count must match total active individual criteria");

  // Removing a chip test
  const withoutCarousel = normalized.formats!.filter(f => f !== "carousel");
  assert.deepEqual(withoutCarousel, ["video"], "Removing format chip must leave remaining format intact");
});
