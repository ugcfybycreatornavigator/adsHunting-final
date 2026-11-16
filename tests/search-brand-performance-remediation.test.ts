import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("session replacement fails active API work instead of leaving permanent loading states", () => {
  const apiClient = read("lib/api-client.ts");
  assert.match(apiClient, /session_invalidated[\s\S]*?throw new SessionReplacedError\(\)/);
  assert.doesNotMatch(apiClient, /session_invalidated[\s\S]*?new Promise\(\(\) => \{\}\)/);
});

test("Discover bounds initial catalog sampling and stale responses", () => {
  const route = read("app/api/search/route.ts");
  const component = read("components/discover-experience.tsx");
  assert.match(route, /const DEFAULT_FEED_SAMPLE_SIZE = 120/);
  assert.doesNotMatch(route, /rangeEnd = rangeStart \+ 999/);
  assert.match(component, /requestController\.current !== controller/);
  assert.match(component, /Search took too long\. Please retry\./);
  assert.match(component, /setLoading\(!cachedDefaultFeed\)/);
  assert.match(component, /nextCursor: result\.nextCursor/);
});

test("search resolves authentication once and parallelizes independent billing and rate checks", () => {
  const route = read("app/api/search/route.ts");
  assert.match(route, /const accessError = await requirePaidWorkspaceAccessForUser\(authRes\.user\.id\)/);
  assert.match(route, /const \[balance, limit\] = await Promise\.all/);
  assert.match(route, /requirePaidWorkspaceAccessForUser\(authRes\.user\.id\)/);
  assert.doesNotMatch(route, /requirePaidWorkspaceAccess\(\)/);
});

test("category enrichment is bounded, deterministic, and dry-run by default", () => {
  const script = read("scripts/enrich-categories-batch.ts");
  assert.match(script, /process\.argv\.includes\("--apply"\)/);
  assert.match(script, /Math\.min\(Math\.max\(.+500.+5_000\)/);
  assert.match(script, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(script, /if \(applyChanges && updates\.length > 0\)/);
  assert.match(script, /isValidCuratedCategory\(existingCat\)/);
});

test("competitor actions use the owned competitor UUID, not provider advertiser ID", () => {
  const dashboard = read("components/competitor-dashboard.tsx");
  const brandData = read("lib/brand-data.ts");
  assert.match(brandData, /competitorId: trackedRecord\?\.id \|\| advertiserId/);
  assert.match(dashboard, /onRefresh\(brand\.advertiserId, brand\.competitorId\)/);
  assert.doesNotMatch(dashboard, /onRefresh\(brand\.advertiserId, brand\.advertiserId\)/);
});

test("competitor stale recovery uses an explicit sync timestamp that exists in migration", () => {
  const route = read("app/api/competitors/route.ts");
  const migration = read("supabase/migrations/20261113000008_competitor_sync_started_at.sql");
  assert.doesNotMatch(route, /competitor\.updated_at|c\.updated_at/);
  assert.match(route, /sync_started_at/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sync_started_at timestamptz/);
});

test("failed competitor refresh preserves historical ad counts", () => {
  const route = read("app/api/competitors/route.ts");
  assert.doesNotMatch(route, /sync_status: "error",[\s\S]{0,100}ads_count: 0/);
});

test("search and competitor refresh responses expose request IDs and total server timing", () => {
  const searchRoute = read("app/api/search/route.ts");
  const competitorRoute = read("app/api/competitors/route.ts");
  for (const route of [searchRoute, competitorRoute]) {
    assert.match(route, /X-Request-Id/);
    assert.match(route, /Server-Timing/);
  }
});
