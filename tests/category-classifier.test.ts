import test from "node:test";
import assert from "node:assert/strict";
import { classifyAdCategory, isValidCuratedCategory } from "../lib/category-classifier";

test("Category Classifier: Gaming matches authentic hardware and excludes idioms", () => {
  // Positive: Gaming controller
  const res1 = classifyAdCategory({
    advertiserName: "Value Pawn and Jewelry",
    headline: "Microsoft Black Gaming Controller",
    body: "Pre-loved merchandise at great prices! Electronics, Gaming gear",
  });
  assert.equal(res1.category, "Gaming");
  assert.equal(res1.nicheId, "gaming");
  assert.ok(res1.confidence >= 0.85);

  // Negative: "skin game" must NOT be gaming
  const res2 = classifyAdCategory({
    advertiserName: "Skincare Co",
    headline: "Upgrade Your Skin Game",
    body: "Deep hydration and glow serum",
  });
  assert.equal(res2.category, "Beauty & Skincare");

  // Negative: "lust game" (erotic drama) must NOT be gaming
  const res3 = classifyAdCategory({
    advertiserName: "DramaBox-Movies",
    headline: "The Lust Game: Seduce Me If You Can",
    body: "A virgin signs up for the ultimate seduction show",
  });
  assert.notEqual(res3.category, "Gaming");
  assert.equal(res3.category, "Media & Entertainment");

  // Negative: "game changer" must NOT be gaming
  const res4 = classifyAdCategory({
    advertiserName: "Acme Logistics",
    headline: "This Freight Solution is a Real Game Changer",
    body: "Manage shipments with zero delays",
  });
  assert.equal(res4.category, "Unknown");
});

test("Category Classifier: Fitness matches athletic gear and excludes garment sizing", () => {
  // Positive: Running shoes / workout
  const res1 = classifyAdCategory({
    advertiserName: "Foot Locker",
    headline: "Made To Move",
    body: "Stay comfortable in styles like the Nike P-6000 running shoes",
    landingPageUrl: "https://www.footlocker.com/category/sport/running.html",
  });
  assert.equal(res1.category, "Fitness");
  assert.equal(res1.nicheId, "fitness");

  // Negative: "slim fit" garment must NOT be fitness
  const res2 = classifyAdCategory({
    advertiserName: "Formal Shirts Ltd",
    headline: "Mens Slim Fit Oxford Shirt",
    body: "Crafted for a tailored, relaxed fit at work",
  });
  assert.notEqual(res2.category, "Fitness");
});

test("Category Classifier: Legacy maturity badges are safely ignored and reclassified", () => {
  assert.equal(isValidCuratedCategory("Testing"), false);
  assert.equal(isValidCuratedCategory("Proven Long Runner"), false);
  assert.equal(isValidCuratedCategory("High-Confidence Winner"), false);
  assert.equal(isValidCuratedCategory("Standard"), false);
  assert.equal(isValidCuratedCategory("Unknown"), false);
  assert.equal(isValidCuratedCategory("Gaming"), true);
  assert.equal(isValidCuratedCategory("Fitness"), true);

  // Ad with legacy badge "Proven Long Runner" but Foxtale sunscreen
  const res = classifyAdCategory({
    advertiserName: "Foxtale",
    headline: "Glow Sunscreen SPF 50",
    body: "Lightweight vitamin C moisturizer",
    existingCategory: "Proven Long Runner",
  });
  assert.equal(res.category, "Beauty & Skincare");
  assert.equal(res.nicheId, "beauty-skincare");
});

test("Category Classifier: Curated genuine categories are preserved", () => {
  const res = classifyAdCategory({
    advertiserName: "Custom Shop",
    headline: "Vintage items",
    existingCategory: "Jewellery & Accessories",
  });
  assert.equal(res.category, "Jewellery & Accessories");
  assert.equal(res.provenance, "curated");
  assert.equal(res.confidence, 1.0);
});

test("Category Classifier: Weak/ambiguous ads stay honest as Unknown", () => {
  const res = classifyAdCategory({
    advertiserName: "Random Brand",
    headline: "Check this out today",
    body: "Click to learn more about our company",
  });
  assert.equal(res.category, "Unknown");
  assert.equal(res.confidence, 0);
  assert.equal(res.provenance, "unclassified");
});
