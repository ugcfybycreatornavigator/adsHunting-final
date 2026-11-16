import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedAd } from "../lib/types";
import { isContentSafeForDiscover, rankRelevantAds } from "../lib/search-relevance";

function ad(id: string, overrides: {
  brand?: string; headline?: string; body?: string; category?: string; product?: string;
} = {}): NormalizedAd {
  const brand = overrides.brand || "Example";
  return {
    id, externalId: id,
    provider: { discoveryProvider: "catalog", fetchedAt: "2026-11-16T00:00:00Z" },
    advertiser: { id: brand, name: brand, displayName: brand, normalizedName: brand.toLowerCase(), pageUrl: null, logoUrl: null, domain: null, social: { facebook: null, instagram: null, linkedin: null } },
    copy: { headline: overrides.headline || null, primaryText: overrides.body || null, description: null, cta: null },
    creative: { type: "unknown", imageUrl: null, videoUrl: null, thumbnailUrl: null, carouselItems: [] },
    delivery: { status: "active", startedAt: null, endedAt: null, daysRunning: 10, platforms: ["facebook"], countries: ["US"] },
    destination: { url: null, resolvedUrl: null, domain: null, title: null, productName: overrides.product || null },
    intelligence: { category: overrides.category || null, creativeFormat: null, hookType: null, offerType: null, winnerScore: 50, labels: [] },
    enrichment: { archiveStatus: "not_requested", status: "complete", qualityScore: 50, lastEnrichedAt: null },
  };
}

test("gaming search keeps strong category/headline matches and excludes weak filler", () => {
  const results = rankRelevantAds([
    ad("category", { category: "Gaming", headline: "Level up your setup" }),
    ad("headline", { headline: "The gaming laptop built for speed" }),
    ad("weak", { body: "Our team played a gaming playlist while packing your order" }),
    ad("none", { headline: "Summer linen collection" }),
  ], "gaming");
  assert.deepEqual(results.map(item => item.id), ["headline", "category"]);
});

test("fitness search uses product, category, headline and primary copy without unrelated filler", () => {
  const results = rankRelevantAds([
    ad("product", { product: "Fitness tracker" }),
    ad("body", { body: "Fitness coaching designed for busy founders" }),
    ad("none", { headline: "Accounting software" }),
  ], "fitness");
  assert.deepEqual(results.map(item => item.id), ["product", "body"]);
});

test("multiword queries require every meaningful token across searchable fields", () => {
  const results = rankRelevantAds([
    ad("complete", { brand: "Nike", headline: "Running shoes for race day" }),
    ad("partial", { brand: "Nike", headline: "Lifestyle collection" }),
  ], "nike running");
  assert.deepEqual(results.map(item => item.id), ["complete"]);
});

test("content safety is an explicit independent filter and does not reject fitness copy", () => {
  assert.equal(isContentSafeForDiscover(ad("safe", { body: "Fitness and body confidence coaching" })), true);
  assert.equal(isContentSafeForDiscover(ad("unsafe", { body: "Explicit nudity and pornographic content" })), false);
});

test("text-only relevant ads remain eligible", () => {
  assert.deepEqual(rankRelevantAds([ad("text", { headline: "Gaming membership" })], "gaming").map(item => item.id), ["text"]);
});
