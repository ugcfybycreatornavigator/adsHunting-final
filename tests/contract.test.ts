import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { refineAd } from "../lib/refinement";
import type { NormalizedAd } from "../lib/types";

test("Contract: refineAd handles undefined delivery safely", () => {
  const ad: Partial<NormalizedAd> = { id: "test-1", externalId: "test-1", delivery: undefined };
  const refined = refineAd(ad);
  assert.ok(refined.delivery);
  assert.equal(refined.delivery.status, "unknown");
  assert.deepEqual(refined.delivery.platforms, []);
});

test("Contract: refineAd handles undefined creative safely", () => {
  const ad: Partial<NormalizedAd> = { id: "test-2", creative: undefined };
  const refined = refineAd(ad);
  assert.ok(refined.creative);
  assert.equal(refined.creative.type, "unknown");
  assert.deepEqual(refined.creative.carouselItems, []);
});

test("Contract: refineAd handles missing advertiser metadata", () => {
  const ad = { id: "test-3" };
  const refined = refineAd(ad);
  assert.ok(refined.advertiser);
  assert.equal(refined.advertiser.name, null);
  assert.equal(refined.advertiser.logoUrl, null);
});

test("Contract: duplicate canonical ads generate stable IDs", () => {
  const ad1 = refineAd({ advertiser: { id: "adv-1", name: "Nike" } as never, copy: { primaryText: "Just do it" } as never });
  const ad2 = refineAd({ advertiser: { id: "adv-1", name: "Nike" } as never, copy: { primaryText: "Just do it" } as never });
  
  // Fingerprints should match and provide a stable ID
  assert.equal(ad1.id, ad2.id);
});

test("Contract: creative variants sharing a provider ad ID remain distinct", () => {
  const first = refineAd({ externalId: "parent-ad", advertiser: { id: "adv-1", name: "Nike" } as never,
    creative: { type: "image", imageUrl: "https://example.com/one.jpg" } as never });
  const second = refineAd({ externalId: "parent-ad", advertiser: { id: "adv-1", name: "Nike" } as never,
    creative: { type: "image", imageUrl: "https://example.com/two.jpg" } as never });
  assert.notEqual(first.id, second.id);
});

test("Contract: edge provider chain is configurable and falls through empty results", () => {
  const source = readFileSync("supabase/functions/_shared/ads/orchestrator.ts", "utf8");
  assert.match(source, /ADS_PROVIDER_PRIORITY/);
  assert.match(source, /meta,foreplay,searchapi/);
  assert.match(source, /NO_USABLE_RESULTS/);
  assert.doesNotMatch(source, /configuredOrder\s*=\s*\["meta",\s*"foreplay"\]/);
});
