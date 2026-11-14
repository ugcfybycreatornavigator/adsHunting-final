import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// =========================================================================
// BATCH 2A: Cashfree Financial Correctness (ISSUE-020, ISSUE-021, ISSUE-024)
// =========================================================================

test("ISSUE-020: Cashfree API version is consistent across production and test assertions", () => {
  const cashfreeSharedPath = path.join(process.cwd(), "supabase/functions/_shared/cashfree.ts");
  const cashfreeShared = fs.readFileSync(cashfreeSharedPath, "utf-8");
  assert.match(
    cashfreeShared,
    /export const CASHFREE_API_VERSION = "2023-08-01";/,
    "Production cashfree.ts must specify CASHFREE_API_VERSION as '2023-08-01'"
  );

  const testFilePath = path.join(process.cwd(), "tests/early-access.test.ts");
  const testFile = fs.readFileSync(testFilePath, "utf-8");
  assert.match(
    testFile,
    /CASHFREE_API_VERSION = "2023-08-01"/,
    "Unit test must assert CASHFREE_API_VERSION === '2023-08-01'"
  );
  assert.doesNotMatch(
    testFile,
    /CASHFREE_API_VERSION = "2026-01-01"/,
    "Outdated version 2026-01-01 must be completely removed"
  );
});

test("ISSUE-021: validateCashfreeEarlyAccessEvidence strictly verifies both order_amount and payment_amount", () => {
  const cashfreeSharedPath = path.join(process.cwd(), "supabase/functions/_shared/cashfree.ts");
  const content = fs.readFileSync(cashfreeSharedPath, "utf-8");

  assert.match(
    content,
    /amountToPaise\(payment\.payment_amount\) === expected\.amountPaise/,
    "Must verify payment.payment_amount matches expected amountPaise"
  );
  assert.match(
    content,
    /amountToPaise\(payment\.order_amount\) === expected\.amountPaise/,
    "Must verify payment.order_amount matches expected amountPaise"
  );
});

test("ISSUE-024: Cashfree webhook dynamically validates against local payment record amount", () => {
  const webhookPath = path.join(process.cwd(), "supabase/functions/cashfree-webhook/index.ts");
  const content = fs.readFileSync(webhookPath, "utf-8");

  assert.doesNotMatch(
    content,
    /Number\(localPayment\.amount_paise\) !== EARLY_ACCESS\.totalPaise/,
    "Webhook must not hardcode comparison to EARLY_ACCESS.totalPaise"
  );

  assert.match(
    content,
    /amountPaise:\s*Number\(localPayment\.amount_paise\)/,
    "Webhook must dynamically validate against localPayment.amount_paise"
  );
});

// =========================================================================
// BATCH 2B: Search Sessions, Credits & Deduplication (ISSUE-034)
// =========================================================================

test("ISSUE-034: DiscoverExperience maintains persistent sessionId across cursor pagination", () => {
  const discoverPath = path.join(process.cwd(), "components/discover-experience.tsx");
  const content = fs.readFileSync(discoverPath, "utf-8");

  assert.match(
    content,
    /searchSessionIdRef = useRef<string \| null>\(null\)/,
    "Must declare searchSessionIdRef to track search sessions across renders"
  );

  assert.match(
    content,
    /if \(!append\) {[\s\S]*?searchSessionIdRef\.current = typeof crypto !== "undefined"/,
    "Must generate a new sessionId only when starting a new search (!append)"
  );

  assert.match(
    content,
    /const sessionId = nextFilters\.sessionId \|\| searchSessionIdRef\.current \|\| undefined;/,
    "Must preserve searchSessionIdRef when nextFilters does not provide a new one"
  );

  assert.match(
    content,
    /if \(result\.sessionId\) {[\s\S]*?searchSessionIdRef\.current = result\.sessionId;/,
    "Must sync searchSessionIdRef with server-assigned sessionId"
  );

  assert.match(
    content,
    /search\(\{ \.\.\.filters, cursor, sessionId: searchSessionIdRef\.current \|\| undefined \}, true\)/,
    "Pagination load-more button must explicitly pass active sessionId with append=true"
  );
});

test("ISSUE-034: Search API accepts and echoes persistent sessionId", () => {
  const searchRoutePath = path.join(process.cwd(), "app/api/search/route.ts");
  const content = fs.readFileSync(searchRoutePath, "utf-8");

  assert.match(
    content,
    /sessionId: z\.string\(\)\.max\(64\)\.optional\(\)/,
    "Search schema must accept optional sessionId"
  );

  assert.match(
    content,
    /const sessionId = parsed\.data\.sessionId \|\| requestId;/,
    "Search handler must reuse incoming sessionId if provided"
  );

  assert.match(
    content,
    /payload\.sessionId = sessionId;/,
    "Search handler must attach sessionId to return payload"
  );
});

test("ISSUE-034: Credit schema refinement migration defines atomic idempotency constraint", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20260908120000_credit_schema_refinement.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true, "Credit schema refinement migration must exist");

  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(
    sql,
    /ADD CONSTRAINT uq_credit_usage_event UNIQUE \(workspace_id, search_session_id, idempotency_key, event_type\)/,
    "Unique constraint must enforce idempotency on (workspace_id, search_session_id, idempotency_key, event_type)"
  );

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.report_search_and_delivery_usage/,
    "Migration must create report_search_and_delivery_usage RPC"
  );

  assert.match(
    sql,
    /ON CONFLICT \(workspace_id, search_session_id, idempotency_key, event_type\) DO NOTHING/,
    "RPC must use ON CONFLICT DO NOTHING for deduplicating delivery charges"
  );
});

// =========================================================================
// BATCH 2C: Competitor Sync & Saved-Ad Tagging (ISSUE-035, ISSUE-037)
// =========================================================================

test("ISSUE-035: Competitors route implements stale sync recovery in GET and PATCH", () => {
  const competitorsPath = path.join(process.cwd(), "app/api/competitors/route.ts");
  const content = fs.readFileSync(competitorsPath, "utf-8");

  // GET stale healing
  assert.match(
    content,
    /const twoMinutesAgo = Date\.now\(\) - 2 \* 60 \* 1000;/,
    "GET handler must calculate 2-minute stale threshold"
  );
  assert.match(
    content,
    /comp\.sync_status = "error";\s*comp\.sync_error = "Sync timed out\. Please retry\.";/,
    "GET handler must auto-heal stale syncing records to error status"
  );

  // PATCH retry allowance
  assert.match(
    content,
    /const isStale = competitor\.sync_status === "syncing" && competitor\.sync_started_at && new Date\(competitor\.sync_started_at\)\.getTime\(\) < twoMinutesAgo;/,
    "PATCH handler must check if current syncing lock is stale"
  );
  assert.match(
    content,
    /if \(competitor\.sync_status === "syncing" && !isStale\)/,
    "PATCH handler must allow retry when competitor sync is stale"
  );
});

test("ISSUE-035: syncCompetitorAds enforces 8-second timeout on upstream provider", () => {
  const brandDataPath = path.join(process.cwd(), "lib/brand-data.ts");
  const content = fs.readFileSync(brandDataPath, "utf-8");

  assert.match(
    content,
    /Provider search timed out after 8000ms/,
    "Provider search in syncCompetitorAds must reject after 8000ms"
  );
  assert.match(
    content,
    /Promise\.race\(\[provider\.searchAds\(filters\), timeoutPromise\]\)/,
    "Provider call must race against timeout to prevent serverless execution hard-kill"
  );
});

test("ISSUE-037: Tags API verifies ownership via swipe_file_items and swipe_files", () => {
  const tagsRoutePath = path.join(process.cwd(), "app/api/tags/route.ts");
  const content = fs.readFileSync(tagsRoutePath, "utf-8");

  assert.doesNotMatch(
    content,
    /\.from\("saved_ads"\)/,
    "Tags route must not query obsolete saved_ads table"
  );

  assert.match(
    content,
    /\.from\("swipe_file_items"\)\s*\.select\("id, swipe_files!inner\(user_id\)"\)\s*\.eq\("id", parsed\.data\.savedAdId\)\s*\.eq\("swipe_files\.user_id", auth\.user!\.id\)/,
    "POST /api/tags must verify ownership via swipe_file_items joining swipe_files"
  );

  assert.match(
    content,
    /\.from\("swipe_file_items"\)\s*\.select\("id, swipe_files!inner\(user_id\)"\)\s*\.eq\("id", savedAdId\)\s*\.eq\("swipe_files\.user_id", auth\.user!\.id\)/,
    "DELETE /api/tags must verify ownership before deleting tag links"
  );
});

test("ISSUE-037: Migration 20261113000002 updates saved_ad_tags foreign key to swipe_file_items with cascade", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20261113000002_fix_saved_ad_tags_swipe_files.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true, "Tagging migration must exist");

  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(
    sql,
    /FOREIGN KEY \(saved_ad_id\) REFERENCES public\.swipe_file_items\(id\) ON DELETE CASCADE/,
    "Foreign key must reference public.swipe_file_items(id) with CASCADE delete"
  );

  assert.match(
    sql,
    /SELECT 1 FROM public\.swipe_file_items sfi[\s\S]*?JOIN public\.swipe_files sf ON sf\.id = sfi\.swipe_file_id[\s\S]*?WHERE sfi\.id = saved_ad_id AND sf\.user_id = auth\.jwt\(\)->>'sub'/,
    "RLS policy must verify user owns the swipe file containing the item"
  );
});

// =========================================================================
// BATCH 2D: Team Invitations & Pricing Copy (ISSUE-036, ISSUE-038)
// =========================================================================

test("ISSUE-036: Team invitation server action has zero fake setTimeout or mock success", () => {
  const actionsPath = path.join(process.cwd(), "app/(workspace)/settings/team/actions.ts");
  const content = fs.readFileSync(actionsPath, "utf-8");

  assert.doesNotMatch(
    content,
    /setTimeout/,
    "Team actions must contain zero simulated setTimeout calls"
  );

  assert.doesNotMatch(
    content,
    /return \{ success: true, message: `Invitation sent to \$\{email\}` \}/,
    "Team actions must never return mocked success in production"
  );

  assert.match(
    content,
    /Team invitations for \$\{email\} are currently in private beta for Early Access workspaces/,
    "Team actions must honestly inform users that multi-seat provisioning is in private beta"
  );
});

test("ISSUE-038: Public pricing page displays accurate Early Access copy without false free trial claims", () => {
  const pricingPath = path.join(process.cwd(), "app/(marketing)/pricing/page.tsx");
  const content = fs.readFileSync(pricingPath, "utf-8");

  assert.doesNotMatch(
    content,
    /Start 7-Day Free Trial/,
    "Pricing page CTA must not promise a 7-day free trial"
  );

  assert.match(
    content,
    /Get Early Access/,
    "Pricing page CTA must state 'Get Early Access'"
  );

  assert.doesNotMatch(
    content,
    /\{plan\.trialDays\}-day free trial included\./,
    "Pricing page must not claim a 7-day free trial is included"
  );

  assert.match(
    content,
    /Instant access to ad intelligence\./,
    "Pricing page copy must state 'Instant access to ad intelligence.'"
  );

  // Marketing config
  const configPath = path.join(process.cwd(), "data/landing/config.ts");
  const config = fs.readFileSync(configPath, "utf-8");
  const scoutBlock = config.match(/id:\s*"scout"[\s\S]*?features:/)?.[0] || "";
  assert.doesNotMatch(
    scoutBlock,
    /trialDays:\s*7/,
    "Scout pricing plan in landing config must not declare trialDays: 7"
  );
});
