import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(refined.advertiser.name, "Unknown Advertiser");
  assert.equal(refined.advertiser.logoUrl, null);
});

test("Contract: duplicate canonical ads generate stable IDs", () => {
  const ad1 = refineAd({ advertiser: { id: "adv-1", name: "Nike" } as any, copy: { primaryText: "Just do it" } as any });
  const ad2 = refineAd({ advertiser: { id: "adv-1", name: "Nike" } as any, copy: { primaryText: "Just do it" } as any });
  
  // Fingerprints should match and provide a stable ID
  assert.equal(ad1.id, ad2.id);
});
