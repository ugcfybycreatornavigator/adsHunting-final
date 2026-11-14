import test from "node:test";
import assert from "node:assert/strict";
import { recentTerms, rankSuggestions, relatedToHistory, historyStorageKey, type SearchSuggestion } from "../lib/search-suggestions";

const brands: SearchSuggestion[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i), type: "brand", label: "Brand " + i, normalizedLabel: "brand " + i,
}));
test("related suggestions require actual shared name tokens, including Unicode", () => {
  assert.equal(relatedToHistory("Nike Running", ["nike"]), true);
  assert.equal(relatedToHistory("Café Studio", ["café"]), true);
  assert.equal(relatedToHistory("Unrelated", ["nike"]), false);
  assert.equal(relatedToHistory("Ad Studio", ["ad"]), false);
});
test("recent history validates, normalizes, deduplicates and bounds persisted input", () => {
  assert.deepEqual(recentTerms([" Nike ", "NIKE", null, "", "ＡＢＣ", "ABC", "LayerStory"]), ["Nike", "ＡＢＣ", "LayerStory"]);
  assert.equal(recentTerms(brands.map(b => b.label)).length, 5);
  assert.deepEqual(recentTerms({ malicious: "value" }), []);
  assert.deepEqual(recentTerms(["x".repeat(161)]), []);
});
test("accounts use distinct history keys without sharing a legacy global key", () => {
  assert.notEqual(historyStorageKey("tenant-a"), historyStorageKey("tenant-b"));
});
test("ranking prioritizes exact before prefix and removes duplicate display names", () => {
  const matches = rankSuggestions([...brands, { ...brands[1], id: "duplicate", label: "BRAND 1" }], " brand 1 ", [], "");
  assert.equal(matches[0].id, "1");
  assert.equal(new Set(matches.map(b => b.label.toLowerCase())).size, matches.length);
});
test("blank ranking is stable, diverse and rotates by seed", () => {
  const first = rankSuggestions(brands, "", [], "day1");
  assert.deepEqual(first, rankSuggestions(brands, "", [], "day1"));
  assert.equal(first.length, 8);
  assert.notDeepEqual(first, rankSuggestions(brands, "", [], "day2"));
  assert.equal(rankSuggestions(brands, "", ["Brand 30"], "day1")[0].id, "30");
});
test("suggestions route is read-only, escaped, timed and fails safely with mocked auth/database", async () => {
  // Test doubles are local only; this is not hosted RLS or provider evidence.
  const authPath = require.resolve("../lib/auth");
  const billingPath = require.resolve("../lib/billing/entitlement");
  const oldAuth = require.cache[authPath], oldBilling = require.cache[billingPath];
  let authenticated = true, failure = false;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const { NextRequest, NextResponse } = await import("next/server");
  const stub = (filename: string, exports: unknown) => { require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule; };
  stub(billingPath, { requirePaidWorkspaceAccess: async () => null });
  stub(authPath, { requireUser: async () => authenticated ? {
    user: { id: "test-tenant" }, supabase: { rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return failure ? { error: { message: "private database diagnostic" } } : { data: [{ id: "brand-1", label: "Nike" }] };
    } },
  } : { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } });
  const routePath = require.resolve("../app/api/search/suggestions/route");
  try {
    delete require.cache[routePath];
    const { GET } = require(routePath);
    const response = await GET(new NextRequest("http://localhost/api/search/suggestions?q=Ni%25_"));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("X-Request-Id"));
    assert.match(response.headers.get("Server-Timing")!, /db;dur=/);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "get_search_suggestions");
    assert.equal(calls[0].args.search_query, "Ni\\%\\_");
    assert.equal((await response.json()).suggestions[0].label, "Nike");
    failure = true;
    const failed = await GET(new NextRequest("http://localhost/api/search/suggestions?q=Ni"));
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /private database/);
    authenticated = false;
    const count = calls.length;
    assert.equal((await GET(new NextRequest("http://localhost/api/search/suggestions?q=Ni"))).status, 401);
    assert.equal(calls.length, count);
  } finally {
    delete require.cache[routePath];
    if (oldAuth) require.cache[authPath] = oldAuth; else delete require.cache[authPath];
    if (oldBilling) require.cache[billingPath] = oldBilling; else delete require.cache[billingPath];
  }
});
