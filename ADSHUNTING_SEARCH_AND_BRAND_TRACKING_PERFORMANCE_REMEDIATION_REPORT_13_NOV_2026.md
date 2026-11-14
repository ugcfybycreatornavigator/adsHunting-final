# AdsHunting Search and Brand Tracking Performance Remediation Report

**Date:** 13 November 2026 (Asia/Kolkata)  
**Repository:** `/Users/rahulg/adsHunting 2`  
**Status:** **LOCAL REMEDIATION COMPLETE; DEPLOYMENT, MIGRATION, AUTHENTICATED STAGING, AND PROVIDER-CREDENTIAL ACTIONS PENDING**

## 1. Evidence boundary

The requested `ADSHUNTING_SEARCH_BRAND_TRACKING_PERFORMANCE_REMEDIATION_PROMPT_13_NOV_2026.md` and two screen recordings were not present in the repository or accessible attachment set. They were therefore **NOT REVIEWED**. Investigation proceeded from the stated symptoms and independently verified source, database, provider, build, and test evidence.

No production data was changed, no migration was applied, and no deployment occurred. Production access was limited to read-only Supabase queries, migration-ledger inspection, and read-only provider searches.

## 2. Executive outcome

Five application defects were confirmed and corrected locally:

1. A replaced Clerk session caused `apiFetch` to return a promise that never settled, leaving Discover permanently in “Searching.”
2. Discover’s default feed transferred and normalized up to 1,000 full ad records to display 30.
3. Stale search responses could continue after a newer controller became current.
4. Competitor actions sent the provider advertiser ID where the API required the owned competitor row UUID.
5. Competitor stale-sync recovery referenced a nonexistent `competitors.updated_at` column and fell back to the record’s original `created_at`, causing old records to return to ERROR after Retry.

The code now fails session replacement explicitly, bounds initial feed sampling to 120 rows, rejects stale client responses, caps visible search waiting at 35 seconds, uses competitor UUIDs, records `sync_started_at`, preserves historical counts on refresh failure, and exposes `X-Request-Id` plus `Server-Timing` on main search and competitor refresh responses.

Provider delivery is still externally blocked: the configured Meta token is expired and SearchAPI is rate-limited/cooling down. Nike also has a historical Meta `ads_archive` permission error. These credential/quota conditions were not hidden or bypassed.

## 3. End-to-end root-cause trace

### 3.1 Discover stuck in Searching

Flow: `DiscoverExperience.search()` → `apiFetch()` → `/api/search` → Supabase catalog → provider edge function when required → persistence → usage ledger → UI.

Confirmed causes:

- `lib/api-client.ts` returned `new Promise(() => {})` whenever `session_invalidated=true`. No component `catch` or `finally` could run, so `loading` stayed true forever.
- The initial default feed executed an exact count and fetched up to 1,000 full rows, then selected only 30. The rows include large raw/refined JSON and media metadata.
- Client application of a response was not explicitly guarded by controller identity after JSON parsing.
- There was no client-visible upper bound for a hung request.

Corrections:

- Throw `SessionReplacedError` immediately rather than creating a never-settling promise.
- Reduce the randomized feed sample from 1,000 to 120 without deleting or rewriting catalog history.
- Apply search/brand results only if their controller is still current.
- Abort after 35 seconds and surface `SEARCH_TIMEOUT` with a retry message.
- Return request IDs and total server timing on completed main search responses.

Billing behavior is unchanged: `AD_SEARCH` and `BRAND_SEARCH` remain 15 credits for a genuinely new search; `AD_DELIVERED` remains 10 credits per newly delivered ad through the atomic usage RPC.

### 3.2 Nike and LayerStory ERROR / Retry loop

Flow: competitor card → `PATCH /api/competitors` → ownership lookup by competitor UUID → `syncCompetitorAds()` → provider chain → persistence → status update → server-rendered summaries.

Confirmed application causes:

- All card actions passed `brand.advertiserId` twice. The route validates `id` as UUID and scopes it to the authenticated user, so Meta numeric advertiser IDs could not identify the competitor row.
- The route queried `competitor.updated_at`, but the production schema has no such column (`42703`).
- Stale recovery used `updated_at || created_at`; for old records, a new Retry appeared older than two minutes immediately.
- POST failure wrote `ads_count: 0`, even when historical ads already existed.

Corrections:

- Add `competitorId` to server intelligence data and pass it to refresh, pause/resume, and remove actions.
- Add local migration `20261113000008_competitor_sync_started_at.sql` with `sync_started_at timestamptz` and a partial syncing index.
- Set/clear `sync_started_at` around sync attempts and use only that timestamp for stale-lock recovery.
- Preserve historical `ads_count` on provider failure.
- Preserve and expose the actual refresh error in client state instead of replacing it with a generic state only.

## 4. Production read-only findings

The production schema probe confirmed `competitors.updated_at` does not exist.

| Brand record | Stored status | Stored count | Actual indexed ads | Stored error |
|---|---:|---:|---:|---|
| Nike (record 1) | success | 108 | 132 | none |
| Nike (record 2) | error | 0 | 132 | Meta `ads_archive` permission unavailable |
| LayerStory | error | 0 | 29 | Sync failed — provider unavailable |

This proves LayerStory and one Nike tenant retained historical catalog data despite UI error state. The remediation does not delete or overwrite those ads.

Read-only live provider probes:

| Brand | Provider | Result | Duration | Exact blocker |
|---|---|---:|---:|---|
| Nike | Meta | FAIL | 543 ms | `META_TOKEN_EXPIRED` |
| Nike | SearchAPI | FAIL | 861 ms | `SEARCHAPI_RATE_LIMIT` |
| LayerStory | Meta | FAIL | 305 ms | `META_TOKEN_EXPIRED` |
| LayerStory | SearchAPI | FAIL | 0 ms | All configured keys cooling down |

Tracking cannot return fresh provider creatives until an operator renews the Meta token/permissions and restores SearchAPI quota. The application fix ensures Retry reaches the correct record and preserves existing intelligence when providers fail.

## 5. Before-and-after performance measurement

Five read-only queries of each shape were run against the configured Supabase production catalog.

| Metric | Old 1,000-row sample median | New 120-row sample median | Change |
|---|---:|---:|---:|
| Count + fetch total | 2,530 ms | 1,522 ms | 39.8% faster |
| Returned rows | 1,000 | 120 | 88% fewer |
| JSON transfer | ~5.60 MB | ~1.32 MB | ~76% lower |

Observed total ranges were 1,620–3,241 ms before and 1,126–1,811 ms after. These are database/network measurements, not synthetic estimates. End-user authenticated browser timing remains pending because no usable Clerk staging session was supplied.

## 6. Verification results

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero warnings.
- `node --require ./tests/register-typescript.cjs --test tests/*.test.ts`: PASS, 84/84.
- `git diff --check`: PASS.
- `npm run build`: PASS on Next.js 16.3.0; 58/58 static pages generated.
- New remediation suite: 6/6 PASS.
- Stage 1 security, Stage 2 billing/workflow, and Stage 3 backend/history/rate-limit regressions: PASS within the 84-test suite.
- Credit constants and atomic charge path: unchanged and passing.
- Read-only production schema/data probe: PASS.
- Read-only provider probe: executed; providers blocked as listed above.
- Authenticated browser E2E: BLOCKED. Preview-auth mode returned HTTP 500 because Clerk `auth()` could not detect `clerkMiddleware()` when the proxy intentionally bypassed it; this was not counted as a product pass.
- Recordings: NOT RUN because not available.

## 7. Deployment and operator requirements

Migration `20261113000008` is local-only; the remote migration ledger is blank for that version. Do not deploy the application change without applying the reviewed migration first or in the same controlled release window.

Required operator sequence:

1. Review and apply `20261113000008_competitor_sync_started_at.sql` in staging.
2. Deploy the exact reviewed application artifact to staging.
3. Renew the Meta token and verify `ads_archive` permission.
4. Restore SearchAPI quota/cooldown health.
5. Run real Clerk-authenticated Discover searches and Nike/LayerStory Retry tests with request ID and `Server-Timing` capture.
6. Verify 15-credit new-search and 10-credit newly delivered-ad ledger entries, including pagination and retries.
7. Confirm cross-tenant competitor UUIDs return 404 and cannot mutate another tenant.
8. Only after staging evidence, request explicit production deployment approval.

## 8. Final decision

**Application remediation: COMPLETE LOCALLY. Production resolution: BLOCKED BY UNAPPLIED MIGRATION, UNDEPLOYED CODE, PROVIDER CREDENTIAL/QUOTA FAILURES, AND MISSING AUTHENTICATED STAGING EVIDENCE.**

The confirmed races, permanent loading state, over-fetch, incorrect competitor identifier, nonexistent timestamp dependency, and destructive failure count have been corrected with regression coverage. Fresh Nike/LayerStory tracking cannot be declared successful until the external provider blockers are repaired and the exact candidate is tested in authenticated staging.
