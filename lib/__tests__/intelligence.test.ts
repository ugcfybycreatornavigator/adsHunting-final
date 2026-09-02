import assert from "node:assert";
import { computeAdIntelligence, calculateLongevityScore, calculateVariantScore } from "../intelligence";

console.log("Running Signal Intelligence Engine v1.0 Tests...");

// Test 1: Longevity Score
assert.strictEqual(calculateLongevityScore(0).score, 0);
assert.strictEqual(calculateLongevityScore(7).score, 43);
assert.strictEqual(calculateLongevityScore(30).score, 72);
assert.strictEqual(calculateLongevityScore(90).score, 94);
assert.strictEqual(calculateLongevityScore(120).score, 100);
console.log("✓ Longevity score nonlinear calculations passed.");

// Test 2: Variant Score
const single = calculateVariantScore(1);
assert.strictEqual(single.score, 13);
assert.ok(single.label.includes("Single Test"));

const high = calculateVariantScore(8);
assert.strictEqual(high.score, 100);
assert.ok(high.label.includes("High Creative Commitment"));
console.log("✓ Variant score capping and labeling passed.");

// Test 3: Sample Competitor Ad Intelligence
const intel = computeAdIntelligence({
  startDate: "2026-05-15",
  status: "active",
  variants: 6,
  creativeRepetition: 5,
  platforms: ["facebook", "instagram", "messenger"],
  mediaType: "video",
  headline: "Special 50% Off Offer",
  body: "Get your premium skincare set today with free express delivery worldwide.",
  cta: "Shop Now",
  landingPageUrl: "https://example.com/offer",
  advertiserId: "123456",
});

assert.ok(intel.winnerScore >= 75, `Expected winnerScore >= 75, got ${intel.winnerScore}`);
assert.ok(intel.confidenceScore >= 70, `Expected confidence >= 70, got ${intel.confidenceScore}`);
assert.strictEqual(intel.confidenceLabel, "High");
assert.strictEqual(intel.badgeCategory, "Proven Long Runner");
assert.strictEqual(intel.scoreVersion, "v1.0");
console.log("✓ Sample ad deterministic intelligence calculations passed.");

console.log("All Signal Intelligence tests passed successfully!");
