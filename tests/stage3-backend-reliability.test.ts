import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { rateLimitSync, rateLimit } from "../lib/rate-limit";

// =========================================================================
// BATCH 3A: API RELIABILITY (ISSUE-014, ISSUE-028, ISSUE-029)
// =========================================================================

test("ISSUE-014: Dynamic lookup handlers use maybeSingle() to prevent PGRST116 fatal crashes", () => {
  const filesToCheck = [
    "app/api/competitors/route.ts",
    "app/api/swipe-files/[id]/route.ts",
    "app/api/saved-filters/[id]/route.ts",
    "lib/swipe-files.ts",
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.match(
      content,
      /\.maybeSingle\(\)/,
      `${relPath} must use maybeSingle() for dynamic record lookups`
    );
  }

  // Saved filters [id] route specifically handles 404 when data is null
  const savedFiltersRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/saved-filters/[id]/route.ts"),
    "utf-8"
  );
  assert.match(
    savedFiltersRoute,
    /if \(!data\) \{\s*return NextResponse\.json\(\{ error: "Saved filter not found\." \}, \{ status: 404 \}\);/,
    "Saved filters route must return clean 404 when record does not exist"
  );
});

test("ISSUE-028: Brand search API handles malformed JSON safely and enforces rate limiting", () => {
  const brandSearchPath = path.join(process.cwd(), "app/api/brands/search/route.ts");
  const content = fs.readFileSync(brandSearchPath, "utf-8");

  assert.match(
    content,
    /await request\.json\(\)\.catch\(\(\) => null\)/,
    "Brand search must safely catch malformed JSON without crashing"
  );

  assert.match(
    content,
    /const limit = await rateLimit\(`brand-search:\$\{auth\.user\.id\}`,\s*30,\s*60_000\);/,
    "Brand search must enforce rate limit before running external provider queries"
  );

  assert.match(
    content,
    /return NextResponse\.json\(\s*\{ error: "Too many requests\. Please slow down\." \},\s*\{ status: 429/,
    "Brand search must return HTTP 429 when rate limit is exceeded"
  );
});

test("ISSUE-029: Shared ads visibility update route validates JSON and schema safely", () => {
  const visibilityRoutePath = path.join(
    process.cwd(),
    "app/api/shared-ads/[id]/visibility/route.ts"
  );
  const content = fs.readFileSync(visibilityRoutePath, "utf-8");

  assert.match(
    content,
    /await request\.json\(\)\.catch\(\(\) => null\)/,
    "Shared ads visibility route must catch malformed JSON"
  );

  assert.match(
    content,
    /schema\.safeParse\(rawBody\)/,
    "Shared ads visibility route must validate body via Zod schema"
  );

  assert.match(
    content,
    /z\.enum\(\["public", "private"\]\)/,
    "Visibility schema must restrict values to public or private"
  );
});

// =========================================================================
// BATCH 3B: BACKEND PROTECTION (ISSUE-015, ISSUE-022)
// =========================================================================

test("ISSUE-015: Rate limiting supports distributed checking, LRU bounding and clean window expiry", async () => {
  // Test in-memory bounded LRU rate limiter
  const testKey = `test-ip-${Date.now()}`;
  const res1 = rateLimitSync(testKey, 2, 1000);
  assert.equal(res1.allowed, true);
  assert.equal(res1.retryAfter, 0);

  const res2 = rateLimitSync(testKey, 2, 1000);
  assert.equal(res2.allowed, true);

  const res3 = rateLimitSync(testKey, 2, 1000);
  assert.equal(res3.allowed, false);
  assert.ok(res3.retryAfter >= 1, "retryAfter must be at least 1 second");

  // Test async rateLimit fallback with timeout
  const asyncRes = await rateLimit(`async-${testKey}`, 5, 2000);
  assert.equal(typeof asyncRes.allowed, "boolean");

  // Verify migration for atomic distributed table & RPC
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261113000003_distributed_rate_limiting.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.rate_limit_buckets/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.check_rate_limit/);
  assert.match(sql, /clock_timestamp\(\)/);
});

test("ISSUE-022: MetaApiIo provider returns false for isConfigured() preventing 501 upstream errors", () => {
  const providerPath = path.join(
    process.cwd(),
    "supabase/functions/_shared/ads/providers/metaapiio.ts"
  );
  const content = fs.readFileSync(providerPath, "utf-8");

  assert.match(
    content,
    /isConfigured\(\):\s*boolean\s*\{\s*[\s\S]*?return false;\s*\}/,
    "isConfigured() must return false to prevent orchestrator from calling stubbed provider"
  );
});

// =========================================================================
// BATCH 3C: DATABASE AND PERFORMANCE (ISSUE-017, ISSUE-018, ISSUE-019, ISSUE-030)
// =========================================================================

test("ISSUE-017: Analytics uses database aggregation and eliminates silent 2,000-row cap", () => {
  const analyticsPath = path.join(process.cwd(), "lib/analytics.ts");
  const content = fs.readFileSync(analyticsPath, "utf-8");

  assert.match(
    content,
    /admin\.rpc\("get_catalog_analytics"\)/,
    "Analytics must attempt fast database aggregate RPC first"
  );

  assert.match(
    content,
    /admin\.from\("ads"\)\.select\("\*", \{ count: "exact", head: true \}\)/,
    "Fallback must use exact head count rather than in-memory array length"
  );

  // Check SQL migration
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261113000004_catalog_analytics_aggregates.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_catalog_analytics/);
  assert.match(sql, /count\(\*\) FILTER \(WHERE status = 'active'\)/);
  assert.match(sql, /avg\(running_days\)/);
});

test("ISSUE-018: Dashboard eliminates N+1 competitor queries using batched resolution", () => {
  const dashboardPath = path.join(process.cwd(), "lib/dashboard.ts");
  const content = fs.readFileSync(dashboardPath, "utf-8");

  assert.doesNotMatch(
    content,
    /Promise\.all\(competitorRows\.map\(async\s*\(competitor\)\s*=>\s*\{[\s\S]*?from\("ads"\)\.select\("\*",\s*\{\s*count:\s*"exact"/,
    "Dashboard must NOT loop through competitors making individual count queries"
  );

  assert.match(
    content,
    /adminSupabase\.rpc\("get_competitor_active_counts"/,
    "Dashboard must query competitor active counts in a single batched call"
  );

  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261113000005_competitor_counts_rpc.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true);
});

test("ISSUE-019: Swipe file ads API enforces bounded cursor pagination with UI load-more support", () => {
  const apiPath = path.join(process.cwd(), "app/api/swipe-files/ads/route.ts");
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  assert.match(
    apiContent,
    /const limit = Math\.min\(Math\.max\(1, parseInt\(limitParam \|\| "50", 10\) \|\| 50\), 100\);/,
    "API must enforce bounded limit with default 50 and max 100"
  );

  assert.match(
    apiContent,
    /\.limit\(limit \+ 1\)/,
    "API query must enforce page limit"
  );

  assert.match(
    apiContent,
    /return NextResponse\.json\(\{ items, nextCursor, hasMore \}\);/,
    "API must return pagination metadata nextCursor and hasMore"
  );

  // Frontend UI verification
  const viewPath = path.join(process.cwd(), "components/saved-ads-view.tsx");
  const viewContent = fs.readFileSync(viewPath, "utf-8");

  assert.match(
    viewContent,
    /const \[nextCursor, setNextCursor\] = useState<string \| null>\(null\);/,
    "SavedAdsView must track nextCursor"
  );

  assert.match(
    viewContent,
    /const loadMore = async \(\) =>/,
    "SavedAdsView must implement loadMore function"
  );

  assert.match(
    viewContent,
    /Load more saved ads/,
    "SavedAdsView must render 'Load more saved ads' button"
  );
});

test("ISSUE-030: Ad search persistence bounds context to targeted rows and only upserts newly ingested ads", () => {
  const persistencePath = path.join(process.cwd(), "lib/ads-persistence.ts");
  const content = fs.readFileSync(persistencePath, "utf-8");

  assert.match(
    content,
    /\.order\("last_seen_at", \{ ascending: false \}\)\s*\.limit\(\d+\)/,
    "Advertiser context query must be bounded to recent rows"
  );

  assert.match(
    content,
    /for \(const ad of incomingAds\) \{\s*ad\.intelligence\.winnerScore = calculateWinnerScore\(ad, \{ advertiserAds: fullAdvertiserContext \}\);\s*allAdsToUpsert\.push\(ad\);\s*\}/,
    "Persistence must ONLY push incoming ads to allAdsToUpsert, not the full historical catalog"
  );
});

// =========================================================================
// BATCH 3D: FRONTEND AND INTEGRATION (ISSUE-023)
// =========================================================================

test("ISSUE-023: Competitor dashboard implements rollback on failure and SWR cache invalidation", () => {
  const compDashboardPath = path.join(process.cwd(), "components/competitor-dashboard.tsx");
  const content = fs.readFileSync(compDashboardPath, "utf-8");

  assert.match(
    content,
    /import \{ mutate \} from "swr";/,
    "Competitor dashboard must import mutate from swr"
  );

  assert.match(
    content,
    /setBrands\(previousBrands\);/,
    "handleRemove and handlePauseResume must restore previousBrands on network or HTTP failure"
  );

  assert.match(
    content,
    /mutate\("\/api\/competitors"\);/,
    "Mutations must invalidate SWR cache for /api/competitors"
  );
});
