import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { refineAd } from "../lib/refinement";
import { dbAdToNormalized, normalizedToDb, type DatabaseAdRow } from "../lib/catalog";
import { resolveAdIdentities, resolveAdvertiser, realAdvertiserName } from "../lib/advertiser-identity";
import { normalizeDiscoverFilters } from "../lib/filter-utils";
import { MetaProvider } from "../lib/providers/meta";
import { ForeplayProvider, normalizeForeplayAd } from "../lib/providers/foreplay";
import type { BrandIdentity } from "../lib/types";

const nike: BrandIdentity = { id: "123", name: "Nike", provider: "meta", providerAdvertiserId: "123", logoUrl: "https://example.com/nike.png" };
const ad = (id: string, name: string | null) => refineAd({ id: "creative-1", provider: { discoveryProvider: "meta_official", fetchedAt: "2026-09-05" }, advertiser: { id, name } as never });

test("resolution order, matched context, mismatches, keyword safety and unknown UI fallback", () => {
  const canonical = { ...nike, name: "Canonical Nike" };
  assert.equal(resolveAdIdentities([ad("123", "Provider Nike")], [canonical], nike, "123")[0].advertiser.name, "Provider Nike");
  assert.equal(resolveAdIdentities([ad("123", null)], [canonical], nike, "123")[0].advertiser.name, "Canonical Nike");
  const matched = resolveAdIdentities([ad("123", null)], [], nike, "123")[0];
  assert.equal(matched.advertiser.name, "Nike");
  assert.equal(matched.advertiser.logoUrl, nike.logoUrl);
  assert.equal(resolveAdIdentities([ad("999", null)], [], nike, "123").length, 0);
  assert.equal(resolveAdIdentities([ad("123", null)], [], nike)[0].advertiser.name, null);
  assert.equal(resolveAdIdentities([ad("123", null)], [canonical])[0].advertiser.name, "Canonical Nike");
  const wrongProvider = { ...ad("123", null), provider: { discoveryProvider: "foreplay" as const, fetchedAt: "2026-09-05" } };
  assert.equal(resolveAdIdentities([wrongProvider], [], nike, "123").length, 0);
  const unknown = ad("123", null);
  assert.equal(normalizedToDb(unknown).advertiser_name, "");
  assert.equal(unknown.advertiser.displayName || unknown.advertiser.name || "Advertiser", "Advertiser");
  for (const name of ["Advertiser", "Unknown Brand", "Unknown Advertiser", "123", " "]) assert.equal(realAdvertiserName(name), null);
});

test("identity survives persistence, cached JSON, refinement and URL refresh; empty updates preserve name", () => {
  const resolved = resolveAdIdentities([ad("123", null)], [], nike, "123")[0];
  const row = { ...normalizedToDb(resolved), id: "row-uuid" } as DatabaseAdRow;
  const refreshed = dbAdToNormalized(JSON.parse(JSON.stringify(row)));
  assert.equal(refreshed.id, resolved.id);
  assert.equal(refineAd(refreshed).advertiser.name, "Nike");
  assert.equal(JSON.parse(JSON.stringify(refreshed)).advertiser.logoUrl, nike.logoUrl);
  const stale = { ...row, refined_data: ad("123", null) as never };
  assert.equal(dbAdToNormalized(stale).advertiser.name, "Nike");
  const update = resolveAdvertiser(ad("123", null).advertiser, undefined, undefined, refreshed.advertiser);
  assert.equal(update.name, "Nike");
  const params = new URLSearchParams({ brand: nike.id, selectedBrand: JSON.stringify(nike) });
  assert.deepEqual(normalizeDiscoverFilters({ brand: params.get("brand")!, selectedBrand: JSON.parse(params.get("selectedBrand")!) }).selectedBrand, nike);
  assert.equal(normalizeDiscoverFilters({ query: "running shoes", selectedBrand: nike }).selectedBrand, undefined);
});

test("Meta request asks for identity and scopes by page ID, preserving raw evidence", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("search_page_ids"), '["123"]');
    assert.equal(url.searchParams.has("search_terms"), false);
    assert.ok(url.searchParams.get("fields")?.includes("page_id,page_name"));
    return Response.json({ data: [{ id: "1", page_id: "123" }, { id: "2", page_id: "999" }, { id: "3" }] });
  };
  try {
    const result = await new MetaProvider({ accessToken: "test", apiVersion: "v26.0" }).searchAds({ brand: "123", query: "running shoes", selectedBrand: nike });
    assert.equal(result.ads.length, 1);
    assert.equal(result.ads[0].advertiser.name, "Nike");
    assert.equal(result.ads[0].rawData?.page_id, "123");
  } finally { globalThis.fetch = original; }
});

test("Foreplay brand endpoint and matching brand ID are mandatory; provider name wins", async () => {
  const brand: BrandIdentity = { ...nike, id: "fp-brand", providerAdvertiserId: "fp-brand", provider: "foreplay" };
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async input => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/brand/getAdsByBrandId");
    assert.equal(url.searchParams.get("brand_ids"), "fp-brand");
    assert.equal(url.searchParams.has("query"), false);
    return Response.json({ data: [{ id: "one", brand_id: "fp-brand", headline: "Creative title" }, { id: "two", brand_id: "other" }], metadata: {} });
  };
  try {
    const provider = new ForeplayProvider("test");
    await assert.rejects(provider.searchAds({ brand: "123", selectedBrand: nike }));
    assert.equal(calls, 0);
    const result = await provider.searchAds({ brand: brand.id, selectedBrand: brand, query: "Nike" });
    assert.equal(result.ads.length, 1);
    assert.equal(result.ads[0].advertiser.name, "Nike");
    assert.equal(normalizeForeplayAd({ name: "Nike Strength", brand_id: "fp-brand", headline: "Buy equipment" }).advertiser.name, "Nike Strength");
    assert.equal(normalizeForeplayAd({ brand_id: "fp-brand", headline: "Buy equipment" }).advertiser.name, null);
  } finally { globalThis.fetch = original; }
});

test("edge Meta and Foreplay adapters enforce scoped identity without generic fallback", async () => {
  const { MetaProvider: EdgeMetaProvider } = require("../supabase/functions/_shared/ads/providers/meta");
  const { ForeplayProvider: EdgeForeplayProvider } = require("../supabase/functions/_shared/ads/providers/foreplay");
  const original = globalThis.fetch;
  const foreplayBrand: BrandIdentity = { id: "fp-brand", name: "Nike", provider: "foreplay", providerAdvertiserId: "fp-brand" };
  const seenPaths: string[] = [];

  globalThis.fetch = async input => {
    const url = new URL(String(input));
    seenPaths.push(url.pathname);
    if (url.hostname === "graph.facebook.com") {
      assert.equal(url.searchParams.get("search_page_ids"), '["123"]');
      assert.equal(url.searchParams.has("search_terms"), false);
      return Response.json({ data: [{ id: "meta-1", page_id: "123" }, { id: "meta-2", page_id: "999" }] });
    }
    assert.equal(url.pathname, "/api/brand/getAdsByBrandId");
    assert.equal(url.searchParams.get("brand_ids"), "fp-brand");
    assert.equal(url.searchParams.has("query"), false);
    return Response.json({ data: [{ id: "fp-1", brand_id: "fp-brand" }, { id: "fp-2", brand_id: "other" }], metadata: {} });
  };

  try {
    const meta = await new EdgeMetaProvider({ accessToken: "test", apiVersion: "v26.0" }).searchAds({ brand: "123", selectedBrand: nike });
    assert.equal(meta.ads.length, 1);
    assert.equal(meta.ads[0].advertiser.name, "Nike");

    await assert.rejects(
      new EdgeForeplayProvider("test").searchAds({ brand: "123", selectedBrand: nike }),
      /No verified Foreplay brand ID/
    );
    assert.equal(seenPaths.filter(path => path === "/api/brand/getAdsByBrandId").length, 0);

    const foreplay = await new EdgeForeplayProvider("test").searchAds({ brand: "fp-brand", selectedBrand: foreplayBrand, query: "Nike" });
    assert.equal(foreplay.ads.length, 1);
    assert.equal(foreplay.ads[0].advertiser.name, "Nike");
  } finally { globalThis.fetch = original; }
});

test("Discover has no brand-specific ranking hardcode and DB query is scoped", () => {
  const route = readFileSync("app/api/search/route.ts", "utf8");
  assert.doesNotMatch(route, /foxtale/i);
  assert.match(route, /query\.eq\("advertiser_id", filters\.selectedBrand\?\.providerAdvertiserId \|\| filters\.brand\)/);
});
