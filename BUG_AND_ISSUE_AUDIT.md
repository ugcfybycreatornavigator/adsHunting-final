# BUG_AND_ISSUE_AUDIT.md — Exhaustive Codebase Audit (`adsHunting-final`)

**Target Repository**: `adshunting.com` (`adsHunting-final`)  
**Audit Type**: Forensic Codebase Audit, Security Vulnerability Assessment & Technical Debt Review  
**Auditor**: Principal Staff Software Engineer & QA Architect  
**Scope**: Full repository (`app/`, `components/`, `lib/`, `hooks/`, `data/`, `supabase/`, `scripts/`, `tests/`)  
**Status**: COMPLETE — ZERO TOLERANCE BASELINE  

---

## 1. Duplicate, Overlapping, Redundant & Dead Pages / Routes

### 1.1 Duplicate & Competing Workspace / Marketing Pages

#### 1. `/saved` vs `/swipe-files` (Fragmented Creative Collection Library)
* **Locations**:
  * `app/(workspace)/(paid)/saved/page.tsx:1-27`
  * `app/(workspace)/(paid)/swipe-files/page.tsx:1-56`
  * `components/sidebar-swipe-files.tsx:49, 96, 144`
* **Root Cause**:
  * `/saved` strictly renders `SavedAdsView` bound to the system default folder (`is_system = true`, `system_key = 'saved_ads'`).
  * `/swipe-files` strictly renders `SwipeFilesManager` and explicitly filters OUT system folders (`files.filter(f => !f.isSystem)`).
  * Both views operate on the exact same database tables (`swipe_files` and `swipe_file_items`).
* **Impact**:
  * The user experience is fractured across two competing navigation items ("Saved Ads" vs "Swipe Files"). Users cannot view their custom folders from `/saved`, nor can they see their default "Saved Ads" on `/swipe-files`.
* **Remediation**:
  * Consolidate into a single unified `/swipe-files` interface featuring a dedicated "All Saved Ads" root tab alongside custom folders. Deprecate `/saved` and issue a permanent 308 redirect from `/saved` to `/swipe-files`.

#### 2. `/brands` vs `/competitors` (Competing Advertiser Intelligence Views)
* **Locations**:
  * `app/(workspace)/(paid)/brands/page.tsx:1-35`
  * `app/(workspace)/(paid)/competitors/page.tsx:1-28`
  * `components/brand-card.tsx` vs `components/competitor-dashboard.tsx`
* **Root Cause**:
  * `/brands` acts as a public catalog directory of tracked advertiser pages.
  * `/competitors` acts as a private monitoring list where users track specific advertisers.
  * Both routes load advertiser intelligence from the exact same table (`competitors`), invoke identical backend helpers (`lib/brand-data.ts`), and display identical metric cards (active ads, media formats, launch trends).
* **Impact**:
  * Redundant cognitive overhead. Users are confused whether to search advertisers in "Brands" or "Competitors". Sync statuses and tracking toggles can get out of sync between the two interfaces.
* **Remediation**:
  * Merge `/brands` into `/competitors` as a single tabbed module: "My Tracked Competitors" and "Discover Advertisers".

#### 3. `/brands/[id]` vs `/competitors/[id]` (100% Identical Dynamic Route Implementation)
* **Locations**:
  * `app/(workspace)/(paid)/brands/[id]/page.tsx:1-33`
  * `app/(workspace)/(paid)/competitors/[id]/page.tsx:1-26`
* **Root Cause**:
  * Both files execute identical logic:
    ```typescript
    const { id } = await params;
    const auth = await requireUser();
    const data = await getCompetitorIntelligence(id, ...);
    const { count } = await auth.supabase.from("competitors").select("*", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("advertiser_id", id);
    return <BrandIntelligenceProfile data={data} initialTracking={count > 0} />;
    ```
  * The ONLY difference between the two files is the back button link (`<Link href="/brands">` vs `<Link href="/competitors">`).
* **Impact**:
  * Maintenance trap. Any styling or functionality fix applied to `/competitors/[id]` must be manually duplicated in `/brands/[id]`.
* **Remediation**:
  * Retain `/competitors/[id]` (or `/brands/[id]`), delete the other, and create a `redirect()` handler to normalize traffic to the canonical dynamic route.

#### 4. `/faq` vs `/resources/help` (Dual FAQ Pages)
* **Locations**:
  * `app/(workspace)/faq/page.tsx:1-218`
  * `app/(marketing)/resources/help/page.tsx:1-74`
  * `data/faq.ts:1-120`
* **Root Cause**:
  * Two completely separate pages render FAQ entries from `data/faq.ts`. `/faq` is nested inside the authenticated workspace layout, while `/resources/help` is styled as an unauthenticated marketing documentation page.
* **Impact**:
  * Inconsistent branding, duplicate route maintenance, and fractured SEO indexing.
* **Remediation**:
  * Standardize `/resources/help` as the canonical Help Center page. Inside the authenticated workspace, link directly to `/resources/help` or open it in a clean modal.

#### 5. `/login` vs `/sign-in` & `/signup` vs `/sign-up` (Redundant Auth Redirect Hops)
* **Locations**:
  * `app/login/page.tsx:1-12` -> `app/sign-in/[[...sign-in]]/page.tsx:1-32`
  * `app/signup/page.tsx:1-12` -> `app/sign-up/[[...sign-up]]/page.tsx:1-32`
  * `next.config.mjs:18-31`
* **Root Cause**:
  * Next.js configuration and stub pages maintain legacy `/login` and `/signup` routes that issue client/server redirects to Clerk's canonical `/sign-in` and `/sign-up` paths.
* **Impact**:
  * Internal workspace links (e.g. `redirect("/login")` in `brands/page.tsx:14`, `saved/page.tsx:13`, `swipe-files/page.tsx:16`) suffer unnecessary redirect hops (307 -> 308 -> final page).
* **Remediation**:
  * Update all internal redirects across `app/` to target `/sign-in` directly. Retain only `next.config.mjs` permanent redirects for legacy bookmarks.

---

### 1.2 Duplicate & Orphaned UI Components

#### 1. `components/brand-profile.tsx` vs `components/brand-intelligence-profile.tsx`
* **File**: `components/brand-profile.tsx` (2.1 KB)
* **Status**: DEAD CODE / UNIMPORTED.
* **Root Cause**: Legacy component superseded by `components/brand-intelligence-profile.tsx` (9.1 KB). It is never imported anywhere in the project.
* **Remediation**: Delete `components/brand-profile.tsx`.

#### 2. `components/competitor-manager.tsx` vs `components/competitor-dashboard.tsx`
* **File**: `components/competitor-manager.tsx` (6.2 KB)
* **Status**: DEAD CODE / UNIMPORTED.
* **Root Cause**: An older implementation of the competitor tracking view. `app/(workspace)/(paid)/competitors/page.tsx` imports and renders `CompetitorDashboard`. `CompetitorManager` is completely unreferenced.
* **Remediation**: Delete `components/competitor-manager.tsx`.

#### 3. `components/bucket-icon.tsx`
* **File**: `components/bucket-icon.tsx` (1.4 KB)
* **Status**: DEAD CODE / UNIMPORTED.
* **Root Cause**: Leftover SVG icon from prior "Bucket" product branding. All active navigation uses `components/brand/AdsHuntingLogo.tsx` and Lucide icons.
* **Remediation**: Delete `components/bucket-icon.tsx`.

#### 4. `components/profile-popover-test.tsx`
* **File**: `components/profile-popover-test.tsx` (1.8 KB)
* **Status**: DEAD CODE / UNIMPORTED.
* **Root Cause**: Developer scratchpad test component created during profile menu styling. Unreferenced in production code.
* **Remediation**: Delete `components/profile-popover-test.tsx`.

---

### 1.3 Dead / Empty Directories & Debug Boilerplate

#### 1. Empty API and Supabase Edge Function Directories
* **Locations**:
  * `app/api/credits/usage/` (Empty directory, 0 bytes)
  * `app/api/diag/` (Empty directory, 0 bytes)
  * `supabase/functions/billing-cancel-subscription/` (Empty directory, 0 bytes)
  * `supabase/functions/billing-create-subscription/` (Empty directory, 0 bytes)
  * `supabase/functions/billing-reconcile-subscription/` (Empty directory, 0 bytes)
  * `supabase/functions/diagnose-billing/` (Empty directory, 0 bytes)
  * `supabase/functions/razorpay-webhook/` (Empty directory, 0 bytes leftover from Razorpay deprecation)
* **Impact**: Ghost routes in repository, cluttering code navigation and IDE tree views.
* **Remediation**: Remove all empty directories.

#### 2. Boilerplate Sentry Example Routes in Production Build
* **Locations**:
  * `app/sentry-example-page/page.tsx:1-41`
  * `app/api/sentry-example-api/route.ts:1-12`
* **Impact**: Sentry default onboarding test code exposed to public indexing and production attack surface.
* **Remediation**: Delete both files.

#### 3. 22 Loose Scratch/Test Scripts Polluting Project Root
* **Locations**:
  * TypeScript / JavaScript root scripts: `test-cashfree.js`, `test-clerk.ts`, `test-db-insert.js`, `test-duplicate.js`, `test-edge.js`, `test-env.js`, `test-ids.ts`, `test-meta-raw.ts`, `test-recovery.ts`, `test-rpc.js`, `test-search-reliability.js`, `test-search.js`, `test-searchapi-brand.ts`, `test-searchapi-quota.ts`, `test-shared-ads-query.js`, `test-suggestions.js`, `test-sync.ts`, `test_brand.ts`.
  * Python / Shell maintenance scripts: `get_green.py`, `patch_apis.py`, `rebrand.sh`, `replace_blue_with_green.py`.
* **Root Cause**: Ad-hoc development and rebranding scripts left in repository root.
* **Impact**:
  * ESLint parses the root directory and throws **40 errors** and **17 warnings** on these scripts due to `require()` statements and `any` types.
  * Security exposure: several scripts contain ad-hoc testing logic that expects live database or API credentials.
* **Remediation**: Archive useful integration checks into `scripts/` or `tests/`, and delete the rest. Add `scripts/` to `.eslintignore`.

---

### 1.4 Broken Internal Links, Wrong Redirects & 404 Traps

| Location | Faulty Reference / Link | Root Cause | Impact | Fix |
| :--- | :--- | :--- | :--- | :--- |
| `app/(workspace)/(paid)/brands/page.tsx:14` | `redirect("/login")` | Hardcoded legacy auth URL | Extra 307 -> 308 redirect hop | Change to `redirect("/sign-in")` |
| `app/(workspace)/(paid)/saved/page.tsx:13` | `redirect("/login")` | Hardcoded legacy auth URL | Extra 307 -> 308 redirect hop | Change to `redirect("/sign-in")` |
| `app/(workspace)/(paid)/swipe-files/page.tsx:16` | `redirect("/login")` | Hardcoded legacy auth URL | Extra 307 -> 308 redirect hop | Change to `redirect("/sign-in")` |
| `components/settings-nav.tsx:12` | `href="/settings/alerts"` | Targets placeholder page | Leads to dead "Coming soon" screen | Add `(Soon)` badge and disable click, or hide tab |
| `components/settings-nav.tsx:19` | `href="/settings/mcp"` | Targets placeholder page | Leads to dead "Coming soon" screen | Add `(Soon)` badge and disable click, or hide tab |
| `components/settings-nav.tsx:20` | `href="/settings/api"` | Targets placeholder page | Leads to dead "Coming soon" screen | Add `(Soon)` badge and disable click, or hide tab |

---

## 2. Critical & High-Severity Bugs (P0 / P1)

### 2.1 Security & Access Vulnerabilities

#### [BUG-001] P0 — Hardcoded Deftform API Bearer Token Checked Into Git
* **File & Line**: `app/api/feedback/route.ts:105`
* **Vulnerable Code**:
  ```typescript
  const deftformRes = await fetch("https://deftform.com/api/v1/forms/mMbYhG/response", {
    method: "POST",
    headers: {
      "Authorization": "Bearer clUG1XlTfveWtNdgDNXwjGUhrIiXLwA71dci3eCQ76c5e684",
      "Accept": "application/json"
    },
    body: deftformPayload
  });
  ```
* **Root Cause**: Third-party production API token hardcoded as a string literal instead of reading from `process.env.DEFTFORM_API_TOKEN`.
* **Impact**:
  * Complete compromise of the Deftform account and feedback inbox.
  * Any user or automated bot reading client/server bundles or public repo history can extract this bearer token, query existing user submissions, exfiltrate user feedback/attachments, or flood the endpoint with spam.
* **Remediation**:
  1. Immediately revoke the token `clUG1XlTfve...` in the Deftform console.
  2. Move token to `process.env.DEFTFORM_API_TOKEN` and validate in `lib/env/server.ts`.

---

#### [BUG-002] P0 — Complete Database Row Level Security (RLS) Bypass in User Context
* **File & Line**: `lib/auth.ts:84-87`
* **Vulnerable Code**:
  ```typescript
  // Bypass Clerk JWT requirement by returning admin client for now
  // const supabase = await createClerkSupabaseServerClient();
  const supabase = admin;
  return { userId: authObj.userId, user: await currentUser(), supabase, error: null, sessionReplaced: false };
  ```
* **Root Cause**:
  * Instead of returning a scoped user client configured with the caller's Clerk JWT (or user impersonation context), `requireUser()` returns `admin`, which is the Supabase `service_role` superuser client initialized with `SUPABASE_SERVICE_ROLE_KEY`.
* **Impact**:
  * **Every single API route and Server Action calling `auth.supabase` runs with complete RLS bypass**.
  * Database-level policies (`auth.uid() = user_id`) are never evaluated.
  * If ANY route omits a manual `.eq("user_id", auth.userId)` filter in a query, update, or delete statement, any user can read, modify, or delete any other user's records across all database tables.
* **Remediation**:
  * Re-enable `createClerkSupabaseServerClient()` using native Clerk third-party auth tokens for Supabase, or create a scoped server client that sets Postgres session claims (`set_config('request.jwt.claim.sub', userId, true)`). Never return `admin` as the default user client.

---

#### [BUG-003] P1 — Cross-Tenant IDOR in Swipe File Items Mutation
* **File & Line**: `lib/swipe-files.ts:187-214` (`toggleAdInSwipeFile`) & `app/api/swipe-files/items/route.ts:77-79`
* **Vulnerable Code**:
  ```typescript
  export async function toggleAdInSwipeFile(supabase: SupabaseClient, userId: string, adId: string, swipeFileId?: string) {
    let targetFileId = swipeFileId;
    if (!targetFileId) {
      targetFileId = await ensureDefaultSwipeFile(supabase, userId);
    }

    const { data: existing } = await supabase
      .from("swipe_file_items")
      .select("id")
      .eq("swipe_file_id", targetFileId)
      .eq("ad_id", adId)
      .maybeSingle();

    if (existing) {
      await supabase.from("swipe_file_items").delete().eq("id", existing.id);
      return { added: false, swipeFileId: targetFileId };
    } else {
      return addAdToSwipeFile(supabase, userId, adId, targetFileId);
    }
  }
  ```
* **Root Cause**:
  * When `swipeFileId` is provided by the client in `req.json()`, `toggleAdInSwipeFile` directly mutates `swipe_file_items` WITHOUT verifying that `targetFileId` belongs to `userId`.
  * Because `supabase` is the `admin` client (due to `BUG-002`), Row Level Security does not protect the record.
* **Impact**:
  * **Insecure Direct Object Reference (IDOR)**: Any authenticated user who knows or guesses another tenant's `swipe_file_id` (UUID) can inject ads into or delete ads from that tenant's private swipe file.
* **Remediation**:
  * Enforce ownership check before modifying items:
    ```typescript
    const { data: file } = await supabase.from("swipe_files").select("id").eq("id", targetFileId).eq("user_id", userId).maybeSingle();
    if (!file) throw new Error("Swipe file not found or unauthorized.");
    ```

---

#### [BUG-004] P1 — Cross-Tenant IDOR in Swipe File Metadata Retrieval
* **File & Line**: `lib/swipe-files.ts:127-149` (`getSwipeFile`)
* **Vulnerable Code**:
  ```typescript
  export async function getSwipeFile(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
      .from("swipe_files")
      .select(`id, name, description, is_system, system_key, created_at, updated_at, adCount:swipe_file_items(count)`)
      .eq("id", id)
      .single();
  ```
* **Root Cause**:
  * Does not accept or verify `userId`. Queries `swipe_files` by primary key `id` alone using the unconstrained `admin` client.
* **Impact**:
  * Any user can retrieve metadata (folder name, description, creation timestamps, and item count) of any other user's private folders.
* **Remediation**:
  * Pass `userId: string` to `getSwipeFile` and append `.eq("user_id", userId)`.

---

#### [BUG-005] P1 — Hardcoded Platform Owner Email & PostgREST Filter Injection
* **File & Line**: `lib/platform-owner.ts:4, 26`
* **Vulnerable Code**:
  ```typescript
  export const PLATFORM_OWNER_EMAIL = "creatornavigator@gmail.com";
  ...
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, is_platform_owner, role")
    .or(`id.eq.${userId},clerk_user_id.eq.${userId}`)
    .maybeSingle();
  ```
* **Root Cause**:
  * Production owner email `creatornavigator@gmail.com` is committed to git.
  * Line 26 uses raw string template interpolation inside the PostgREST `.or(...)` filter without sanitizing `userId`.
* **Impact**:
  * If `userId` contains commas, quotes, or PostgREST operators, it can manipulate the filter expression.
  * Inability to rotate platform owner email without deploying code.
* **Remediation**:
  * Read owner email from `process.env.PLATFORM_OWNER_EMAIL`.
  * Sanitize `userId` or use parameterized queries instead of raw string interpolation.

---

### 2.2 Billing, Checkout & Usage Vulnerabilities

#### [BUG-006] P1 — Search Pagination Credit Drain Bug (Double-Charging Ads on Every Cursor Fetch)
* **File & Line**: `app/api/search/route.ts:153, 510-525` & `components/discover-experience.tsx:98-103`
* **Vulnerable Code**:
  * In `components/discover-experience.tsx:98`:
    ```typescript
    const response = await apiFetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextFilters), // NEVER passes sessionId!
    });
    ```
  * In `app/api/search/route.ts:153`:
    ```typescript
    const sessionId = parsed.data.sessionId || requestId; // requestId = crypto.randomUUID()!
    ```
  * In `app/api/search/route.ts:511-522`:
    ```typescript
    const deliveryAdIds = payload.ads.map(ad => (ad as any).canonical_ad_id || ad.id).filter((id): id is string => Boolean(id));
    const usageResult = await consumeUsage(
      authRes.user.id,
      authRes.user.id,
      sessionId,
      isNewSearch ? (filters.brand ? "BRAND_SEARCH" : "AD_SEARCH") : null,
      isNewSearch ? searchFingerprint : null,
      baseCost,
      "AD_DELIVERED",
      deliveryAdIds,
      CREDIT_COSTS.AD_DELIVERED
    );
    ```
* **Root Cause**:
  * The frontend `discover-experience.tsx` never generates or passes a persistent `sessionId` across pagination requests.
  * As a result, `app/api/search/route.ts:153` generates a **brand new random UUID** on every single cursor pagination request (`requestId = crypto.randomUUID()`).
  * In the database RPC `report_search_and_delivery_usage`:
    ```sql
    INSERT INTO public.credit_usage_events (...)
    VALUES (...)
    ON CONFLICT (workspace_id, search_session_id, idempotency_key, event_type) DO NOTHING
    ```
  * Because `search_session_id` changes on every cursor pagination call, the `ON CONFLICT` check NEVER MATCHES across pages.
  * Every cursor request charges **10 credits per ad delivered** (`CREDIT_COSTS.AD_DELIVERED = 10`), regardless of whether the user is merely scrolling through results.
* **Impact**:
  * Catastrophic credit depletion. An Early Access user with 3,000 credits scrolling through 100 ads consumes **1,015 credits** in seconds (15 base + 100 ads * 10 credits = 1,015 credits), exhausting their entire monthly balance after browsing just 300 ads.
* **Remediation**:
  1. Generate a persistent `sessionId` in `discover-experience.tsx` for each search query, keeping the same `sessionId` across all cursor pagination requests for that search session.
  2. Maintain a global `Set` or database ledger of already-delivered `ad_id`s for that workspace and billing cycle so ads delivered previously are never re-billed.

---

#### [BUG-007] P1 — Competitor Sync Permanent Lockup on Serverless Execution Timeout
* **File & Line**: `app/api/competitors/route.ts:49, 68-107`
* **Vulnerable Code**:
  ```typescript
  // 1. Insert record with status "syncing"
  const { data: competitor } = await auth.supabase!
    .from("competitors")
    .insert({ ..., sync_status: "syncing", ads_count: -1 })
    .select().single();

  // 2. Synchronously AWAIT external scraping/enrichment
  try {
    const persisted = await syncCompetitorAds(parsed.data.advertiserId);
    ...
    await auth.supabase!.from("competitors").update({ sync_status: "success", ... }).eq("id", competitor.id);
  } catch (err) {
    await auth.supabase!.from("competitors").update({ sync_status: "error", ... }).eq("id", competitor.id);
  }
  ```
* **Root Cause**:
  * `syncCompetitorAds` performs intensive upstream scraping, media normalization, and database insertions.
  * This is executed synchronously inside the Next.js API route handler.
  * On Vercel serverless functions (default 10s–15s execution timeout), if the external scraper takes 12+ seconds, Vercel **hard-terminates the lambda process with a 504 Gateway Timeout**.
  * The Node.js `catch` block never executes because the container is killed.
* **Impact**:
  * The competitor record remains in `sync_status = "syncing"` and `ads_count = -1` **indefinitely**.
  * The frontend shows an infinite loading spinner for that competitor forever. The user cannot re-trigger a sync because the system believes a sync is already running.
* **Remediation**:
  1. Offload competitor sync to a background queue or Supabase Edge Function with generous timeout.
  2. Implement a reconciliation check in `GET /api/competitors`: if `sync_status === "syncing"` and `created_at < now() - interval '2 minutes'`, mark status as `"error"` with message `"Sync timed out. Please retry."`.

---

#### [BUG-008] P1 — Fake / Mocked Team Invitation Server Action
* **File & Line**: `app/(workspace)/settings/team/actions.ts:43-49`
* **Vulnerable Code**:
  ```typescript
  // If we had a real team members table or Clerk Organizations setup, we would insert/invite here.
  // For now, return success to simulate the backend action working correctly.
  
  // Simulate network
  await new Promise(resolve => setTimeout(resolve, 800));

  return { success: true, message: `Invitation sent to ${email}` };
  ```
* **Root Cause**: Mocked `setTimeout(800)` left in production Server Action.
* **Impact**:
  * Enterprise and Agency users are told their team invitation succeeded, but no email is sent, no database record is created, and invited colleagues never receive access.
* **Remediation**:
  * Either implement real Clerk Organizations invitation dispatch (`clerkClient.organizations.createOrganizationInvitation(...)`) or disable the "Invite Member" button with an explicit "Team invitations currently in private beta" message. Never fake successful state updates.

---

## 3. Medium-Severity Bugs & State/Data Flaws (P2)

### 3.1 React, Next.js & SWR Data State Bugs

#### [BUG-009] P2 — Supabase `.single()` Throws Fatal `PGRST116` on Non-Existent Records
* **Files & Lines**:
  * `app/share/[token]/page.tsx:20` (`admin.from("shared_ad_links").select(...).eq("token_hash", token).single()`)
  * `app/api/competitors/route.ts:83` (`auth.supabase.from("competitors").select(...).eq("id", competitor.id).single()`)
  * `app/api/competitors/route.ts:163` (`auth.supabase.from("competitors").select(...).eq("id", id).eq("user_id", auth.user.id).single()`)
  * `app/api/swipe-files/[id]/route.ts:19` (`auth.supabase.from("swipe_files").select("is_system").eq("id", id).eq("user_id", auth.userId).single()`)
* **Root Cause**:
  * In Supabase/PostgREST, `.single()` treats 0 returned rows as an HTTP 406 / Postgres error `PGRST116` ("JSON object requested, multiple (or no) rows returned").
* **Impact**:
  * In `app/share/[token]/page.tsx`, `generateMetadata` throws an unhandled exception when an invalid or expired token is passed, crashing the Next.js metadata generator instead of rendering a graceful 404.
  * In `app/api/competitors/route.ts` and `app/api/swipe-files/[id]/route.ts`, requests with non-matching IDs log internal server errors instead of clean 404 responses.
* **Remediation**:
  * Replace all occurrences of `.single()` with `.maybeSingle()`, and test for `if (!data || error)` explicitly.

---

#### [BUG-010] P2 — Ephemeral In-Memory Rate Limiting Ineffective on Serverless
* **File & Line**: `lib/rate-limit.ts:1-13`
* **Vulnerable Code**:
  ```typescript
  const windows = new Map<string, { count: number; reset: number }>();
  export function rateLimit(key: string, max = 30, windowMs = 60_000) { ... }
  ```
* **Root Cause**:
  * In Next.js deployed to Vercel or any serverless runtime, memory is per-container and ephemeral.
  * Cold starts immediately reset the map to empty.
  * Requests distributed across 20 serverless workers allow 20x the configured request rate (e.g. 600 searches/min instead of 30).
  * Inactive IP keys are never deleted, resulting in memory leaks across long-lived warm containers.
* **Impact**:
  * Ineffective rate protection against scrapers and API abusers on `/api/search` and `/api/feedback`.
* **Remediation**:
  * Replace the in-memory `Map` with an Upstash Redis or Supabase RPC-based distributed token-bucket rate limiter.

---

#### [BUG-011] P2 — Plaintext Share Tokens Stored in `shared_ad_links.token_hash`
* **Files & Lines**:
  * `app/api/shared-ads/route.ts:124, 132`
  * `app/share/[token]/page.tsx:19, 59`
* **Vulnerable Code**:
  ```typescript
  const token = "rlt_" + crypto.randomBytes(32).toString("hex");
  await auth.supabase.from("shared_ad_links").insert({
    ...,
    token_hash: token // Stores plaintext token directly!
  });
  ```
* **Root Cause**:
  * Column is named `token_hash`, but code stores the raw token string `rlt_...` directly without hashing.
* **Impact**:
  * If read access to the database or backups is ever compromised, all active share links are exposed in plaintext.
* **Remediation**:
  * Compute `crypto.createHash("sha256").update(token).digest("hex")` and store the hash in `token_hash`. At lookup time in `/share/[token]`, hash the user-supplied token before querying.

---

#### [BUG-012] P2 — Unbounded Memory Ingestion & Truncated Aggregations in `lib/analytics.ts`
* **File & Line**: `lib/analytics.ts:4-5`
* **Vulnerable Code**:
  ```typescript
  const { data } = await supabase
    .from("ads")
    .select("status,running_days,media_type,cta,platforms,start_date")
    .limit(2000);
  const rows = data ?? [];
  ...
  return {
    total: rows.length, // Capped at 2,000!
    active: rows.filter(r => r.status === "active").length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    ...
  };
  ```
* **Root Cause**:
  * Hardcoded `.limit(2000)` pulls up to 2,000 rows into Node.js server memory, then computes analytics using in-memory JavaScript iterations (`reduce`, `filter`, `map`).
* **Impact**:
  * When the database holds 50,000 ads, the analytics page displays `total: 2000`, silently truncating 96% of the catalog. All averages, platform distributions, and CTA statistics are completely wrong.
  * Pulling 2,000 rows on every analytics page load wastes memory and database bandwidth.
* **Remediation**:
  * Replace client-side array processing with Postgres SQL aggregate queries (`SELECT count(*), avg(running_days) FROM ads`, etc.) or a dedicated materialized view.

---

#### [BUG-013] P2 — N+1 SQL Count Queries on Home Dashboard Load
* **File & Line**: `lib/dashboard.ts:56-59`
* **Vulnerable Code**:
  ```typescript
  const tracked = await Promise.all(competitorRows.map(async (competitor) => {
    const activeAds = await countRows("Home.competitorActiveAds", () =>
      adminSupabase.from("ads").select("*", { count: "exact", head: true })
        .eq("advertiser_id", competitor.advertiser_id)
        .eq("status", "active")
    );
    return { name: competitor.advertiser_name, advertiserId: competitor.advertiser_id, activeAds: activeAds ?? 0 };
  }));
  ```
* **Root Cause**:
  * For up to 12 competitor rows, fires 12 individual SQL `SELECT count(*)` queries concurrently.
* **Impact**:
  * Multiplies database round-trips on every home dashboard visit. When combined with the 5 other catalog queries on lines 40-52, the home page executes **18+ separate SQL queries** per page load.
* **Remediation**:
  * Execute a single query:
    ```sql
    SELECT advertiser_id, count(*) as count 
    FROM ads 
    WHERE advertiser_id = ANY(advertiser_ids) AND status = 'active' 
    GROUP BY advertiser_id;
    ```

---

#### [BUG-014] P2 — Unbounded Memory Scan in Swipe File Ads Fetch
* **File & Line**: `app/api/swipe-files/ads/route.ts:20-50`
* **Vulnerable Code**:
  ```typescript
  let query = auth.supabase!
    .from("swipe_file_items")
    .select("id, notes, created_at, swipe_file_id, ads (*), swipe_files!inner(user_id)")
    .eq("swipe_files.user_id", auth.userId)
    .order("created_at", { ascending: false });
  // NO .limit() or cursor pagination!
  const { data: primaryItems, error } = await query;
  ```
* **Root Cause**:
  * The query lacks pagination (`.limit()` or cursor).
* **Impact**:
  * Users with hundreds or thousands of saved ads will trigger enormous database payloads, high serialization latency, and potential out-of-memory errors on serverless lambdas.
* **Remediation**:
  * Implement cursor-based pagination with a default limit of 50 items per page (`limit(50)`).

---

#### [BUG-015] P2 — Early Access Test Suite Assertion Desync (CI/CD Test Suite Failure)
* **File & Line**: `tests/early-access.test.ts:35`
* **Vulnerable Code**:
  ```typescript
  assert.match(cashfree, /CASHFREE_API_VERSION = "2026-01-01"/);
  ```
* **Root Cause**:
  * In commit `de57cf98`, production `supabase/functions/_shared/cashfree.ts:1` was updated to `export const CASHFREE_API_VERSION = "2023-08-01";`.
  * The test assertion in `tests/early-access.test.ts:35` was never updated to match.
* **Impact**:
  * `npm test` fails immediately on fresh repository clones, blocking automated CI test pipelines.
* **Remediation**:
  * Update line 35 of `tests/early-access.test.ts` to assert `"2023-08-01"`.

---

#### [BUG-016] P2 — Stubbed Upstream Provider Throws Unhandled HTTP 501
* **File & Line**: `supabase/functions/_shared/ads/providers/metaapiio.ts:41`
* **Vulnerable Code**:
  ```typescript
  throw new ProviderError("UPSTREAM", "MetaAPI.io adapter is not yet implemented.", 501, false);
  ```
* **Root Cause**:
  * The provider adapter is an empty stub that throws a 501 HTTP exception.
* **Impact**:
  * If MetaAPI.io is enabled in provider configuration, any query attempting to search through this provider will fail with an HTTP 501 error.
* **Remediation**:
  * Guard provider invocation in `lib/ads/provider-orchestrator.ts` so stubbed providers are skipped during failover, or return a clean empty result rather than throwing 501.

---

## 4. Minor Bugs, UI/UX Glitches & Edge Cases (P3)

### 4.1 Broken UI, Dead Buttons & Placeholders

#### [BUG-017] P3 — Settings Navigation Leads to Empty "Coming Soon" Screens
* **Files & Lines**:
  * `app/(workspace)/settings/alerts/page.tsx:23`
  * `app/(workspace)/settings/api/page.tsx:23`
  * `app/(workspace)/settings/mcp/page.tsx:23`
  * `components/settings-nav.tsx:12, 19, 20`
* **Issue**:
  * "Alerts", "MCP", and "API Keys" tabs are fully visible and clickable in the settings sidebar, but lead to static mock screens with "Coming soon" badges.
* **Remediation**:
  * Either hide these tabs until the features are implemented or render them as disabled non-clickable pills with tooltips.

#### [BUG-018] P3 — ESLint Fails with 40 Errors & 17 Warnings
* **Files & Lines**:
  * `app/api/search/route.ts:511:58`, `533:59`, `554:10` (`@typescript-eslint/no-explicit-any`)
  * Root test scripts (`test-cashfree.js`, `test-db-insert.js`, `test-ids.ts`, etc.) using `require()` and unused variables.
* **Issue**:
  * Running `npm run lint` generates 40 errors and 17 warnings, preventing lint checks from passing in CI.
* **Remediation**:
  * Provide explicit TypeScript types for search payload normalization in `app/api/search/route.ts`. Remove or move root test scripts to `scripts/` and add to `.eslintignore`.

#### [BUG-019] P3 — Raw `<img>` Tags Without Next.js Image Optimization
* **Files & Lines**:
  * Found across `components/ad-card.tsx:102`, `components/brand-card.tsx:33, 58`, `components/ad-detail.tsx:269, 765`, `components/competitor-dashboard.tsx:214, 321, 569`.
* **Issue**:
  * Raw HTML `<img>` elements are used for ad creatives, brand logos, and user avatars rather than Next.js `<Image>`.
* **Impact**:
  * Missing responsive `srcset`s, no automatic WebP/AVIF compression, and Cumulative Layout Shift (CLS) on high-latency mobile networks.
* **Remediation**:
  * Migrate ad and brand media to Next.js `<Image>` or a dedicated `<OptimizedImage>` wrapper with proper `sizes` and blur placeholders.

#### [BUG-020] P3 — Missing `alt` Accessibility Attributes on Media Elements
* **Files & Lines**:
  * `components/video-preview.tsx:136` (`<img src={poster} alt="" ... />`)
  * `components/swipe-files-manager.tsx:213` (`<img src={src} alt="" ... />`)
  * `components/sidebar.tsx:265` (`<img src={user.imageUrl} alt="" ... />`)
  * `components/ad-detail.tsx:269` (`<img src={ad.advertiser.logoUrl} alt="" ... />`)
* **Issue**:
  * Critical visual assets have empty `alt=""` attributes, failing WCAG 2.1 Level A compliance.
* **Remediation**:
  * Populate meaningful, localized alt text (e.g. `alt={ad.advertiser.name || "Advertiser brand logo"}`).

---

## 5. Security & Secret Hygiene Audit

### 5.1 Credential & Token Exposure Assessment

| Vulnerability Item | Exact Location | Severity | Exposure Mechanism | Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Deftform API Token** | `app/api/feedback/route.ts:105` | **P0** | Hardcoded Bearer token in source code | Revoke token; migrate to `DEFTFORM_API_TOKEN` env |
| **Supabase Service Role RLS Bypass** | `lib/auth.ts:86` | **P0** | `requireUser()` returns `admin` client | Re-enable Clerk Supabase JWT authentication |
| **Swipe File Item IDOR** | `lib/swipe-files.ts:187` | **P1** | No `user_id` check on folder ID in item toggle | Add folder ownership verification |
| **Swipe File Metadata IDOR** | `lib/swipe-files.ts:127` | **P1** | No `user_id` check in folder metadata lookup | Add `.eq("user_id", userId)` |
| **Plaintext Share Link Tokens** | `app/api/shared-ads/route.ts:132` | **P2** | Raw token stored in `token_hash` column | SHA-256 hash tokens before storage |
| **In-Memory Rate Limiter** | `lib/rate-limit.ts:1` | **P2** | In-memory `Map` resets per serverless instance | Migrate to distributed Redis / Supabase RPC |
| **Platform Owner Email Hardcoded** | `lib/platform-owner.ts:4` | **P1** | Email committed to repository | Read from `PLATFORM_OWNER_EMAIL` env |
| **PostgREST Filter Injection** | `lib/platform-owner.ts:26` | **P1** | Raw string interpolation in `.or(...)` | Parameterize PostgREST filters |

---

## 6. Consolidated Master Fix Backlog (Ordered by Execution Priority)

```mermaid
flowchart TD
    B1[Batch 1: Security, Auth & Billing Blockers - P0/P1] --> B2[Batch 2: Duplicate Pages & Dead Route Cleanup]
    B2 --> B3[Batch 3: Search, Competitors & Data State Bugs - P1/P2]
    B3 --> B4[Batch 4: UI/UX, Forms, Next.js 16 & Lint Cleanup - P2/P3]
```

### Batch 1: Security, Auth & Billing Blockers (P0 / P1)

* [ ] **BUG-001**: Revoke hardcoded Deftform token `clUG1XlTfve...` and migrate to `DEFTFORM_API_TOKEN` environment variable.  
  * **Location**: `app/api/feedback/route.ts:105`  
  * **Severity**: P0  
  * **Remediation**: Read from `process.env.DEFTFORM_API_TOKEN` validated via `lib/env/server.ts`.

* [ ] **BUG-002**: Fix Supabase Row Level Security (RLS) bypass in `requireUser()`.  
  * **Location**: `lib/auth.ts:84-87`  
  * **Severity**: P0  
  * **Remediation**: Re-enable `createClerkSupabaseServerClient()` or set Postgres session claims. Stop returning `admin` client in user context.

* [ ] **BUG-003**: Fix Cross-Tenant IDOR in Swipe File Item mutation (`toggleAdInSwipeFile`).  
  * **Location**: `lib/swipe-files.ts:187-214`  
  * **Severity**: P1  
  * **Remediation**: Validate that `targetFileId` belongs to `userId` before performing inserts or deletes.

* [ ] **BUG-004**: Fix Cross-Tenant IDOR in Swipe File metadata retrieval (`getSwipeFile`).  
  * **Location**: `lib/swipe-files.ts:127-149`  
  * **Severity**: P1  
  * **Remediation**: Require `userId` and append `.eq("user_id", userId)`.

* [ ] **BUG-005**: Remove hardcoded platform owner email and fix PostgREST filter injection.  
  * **Location**: `lib/platform-owner.ts:4, 26`  
  * **Severity**: P1  
  * **Remediation**: Read from `PLATFORM_OWNER_EMAIL` environment variable; sanitize `userId` in `.or(...)`.

* [ ] **BUG-006**: Fix Search pagination credit drain bug.  
  * **Location**: `app/api/search/route.ts:153, 510-525` & `components/discover-experience.tsx:98`  
  * **Severity**: P1  
  * **Remediation**: Generate and pass persistent `sessionId` from client across pagination calls. Deduplicate delivered ad billing per billing cycle.

* [ ] **BUG-007**: Fix Competitor Sync permanent lockup on serverless timeout.  
  * **Location**: `app/api/competitors/route.ts:49, 68-107`  
  * **Severity**: P1  
  * **Remediation**: Offload sync to background worker or Edge Function; add stale-sync timeout reconciliation (`sync_status = "error"` after 2 minutes).

* [ ] **BUG-008**: Replace mocked team invitation server action with real flow or disabled state.  
  * **Location**: `app/(workspace)/settings/team/actions.ts:43-49`  
  * **Severity**: P1  
  * **Remediation**: Dispatch real Clerk invitation or display a clear "Coming soon" state without fake success messages.

---

### Batch 2: Duplicate Pages, Dead Routes & Navigation Cleanup (Architecture / Dead Code)

* [ ] **BUG-009**: Consolidate `/saved` and `/swipe-files` into a single unified creative library.  
  * **Locations**: `app/(workspace)/(paid)/saved/page.tsx`, `app/(workspace)/(paid)/swipe-files/page.tsx`  
  * **Remediation**: Unify folders and default saved ads into `/swipe-files`. Issue 308 redirect from `/saved` to `/swipe-files`.

* [ ] **BUG-010**: Consolidate `/brands` and `/competitors` into a single advertiser intelligence center.  
  * **Locations**: `app/(workspace)/(paid)/brands/page.tsx`, `app/(workspace)/(paid)/competitors/page.tsx`  
  * **Remediation**: Merge into a tabbed `/competitors` interface ("Tracked" & "Directory"). Redirect `/brands` to `/competitors`.

* [ ] **BUG-011**: Delete redundant dynamic route `/brands/[id]` and consolidate onto canonical `/competitors/[id]`.  
  * **Locations**: `app/(workspace)/(paid)/brands/[id]/page.tsx`, `app/(workspace)/(paid)/competitors/[id]/page.tsx`  
  * **Remediation**: Delete `brands/[id]/page.tsx` and redirect to `/competitors/[id]`.

* [ ] **BUG-012**: Delete dead unimported components: `components/brand-profile.tsx`, `components/competitor-manager.tsx`, `components/bucket-icon.tsx`, and `components/profile-popover-test.tsx`.  
  * **Locations**: `components/`  
  * **Remediation**: Remove the 4 dead component files.

* [ ] **BUG-013**: Clean up empty directories across `app/api/` and `supabase/functions/`.  
  * **Locations**: `app/api/credits/usage/`, `app/api/diag/`, `supabase/functions/billing-*/`, `supabase/functions/razorpay-webhook/`  
  * **Remediation**: Remove empty directories from filesystem.

* [ ] **BUG-014**: Delete Sentry boilerplate demo endpoints in production.  
  * **Locations**: `app/sentry-example-page/page.tsx`, `app/api/sentry-example-api/route.ts`  
  * **Remediation**: Delete both files.

* [ ] **BUG-015**: Clean up 22 loose test/rebranding scripts from root directory.  
  * **Locations**: Repository root (`test-*.js`, `test-*.ts`, `*.py`, `*.sh`)  
  * **Remediation**: Move integration checks into `tests/` or `scripts/`, delete scrap files, add `scripts/` to `.eslintignore`.

* [ ] **BUG-016**: Fix redundant internal redirect hops (`/login` -> `/sign-in`).  
  * **Locations**: `app/(workspace)/(paid)/brands/page.tsx:14`, `saved/page.tsx:13`, `swipe-files/page.tsx:16`  
  * **Remediation**: Directly call `redirect("/sign-in")`.

---

### Batch 3: Search, Competitors, Swipe Files & Data/Cache Sync Bugs (P1 / P2)

* [ ] **BUG-017**: Replace `.single()` with `.maybeSingle()` across all routes to prevent `PGRST116` fatal errors.  
  * **Locations**: `app/share/[token]/page.tsx:20`, `app/api/competitors/route.ts:83, 163`, `app/api/swipe-files/[id]/route.ts:19`  
  * **Severity**: P2  
  * **Remediation**: Use `.maybeSingle()` and verify `if (!data)`.

* [ ] **BUG-018**: Migrate in-memory rate limiting to distributed KV/Redis or Supabase RPC.  
  * **Location**: `lib/rate-limit.ts:1-13`  
  * **Severity**: P2  
  * **Remediation**: Integrate Upstash Redis or a Postgres token bucket RPC function.

* [ ] **BUG-019**: Hash shared ad link tokens with SHA-256 before database insertion.  
  * **Locations**: `app/api/shared-ads/route.ts:132`, `app/share/[token]/page.tsx:19, 59`  
  * **Severity**: P2  
  * **Remediation**: Store `sha256(token)` in `token_hash` column.

* [ ] **BUG-020**: Replace in-memory array processing in `lib/analytics.ts` with Postgres SQL aggregates.  
  * **Location**: `lib/analytics.ts:4-5`  
  * **Severity**: P2  
  * **Remediation**: Use database aggregate functions (`count()`, `avg()`) instead of fetching 2,000 rows into server memory.

* [ ] **BUG-021**: Eliminate N+1 SQL queries on home dashboard load.  
  * **Location**: `lib/dashboard.ts:56-59`  
  * **Severity**: P2  
  * **Remediation**: Batch competitor active ad counts into a single grouped query.

* [ ] **BUG-022**: Add cursor-based pagination and `.limit(50)` to Swipe File Ads API.  
  * **Location**: `app/api/swipe-files/ads/route.ts:20-50`  
  * **Severity**: P2  
  * **Remediation**: Restrict query result set to 50 items and implement cursor pagination.

* [ ] **BUG-023**: Fix Early Access test assertion desync (`2023-08-01` vs `2026-01-01`).  
  * **Location**: `tests/early-access.test.ts:35`  
  * **Severity**: P2  
  * **Remediation**: Update test assertion to match production version `"2023-08-01"`.

* [ ] **BUG-024**: Prevent stubbed `metaapiio.ts` provider from throwing unhandled 501 errors in search failover.  
  * **Location**: `supabase/functions/_shared/ads/providers/metaapiio.ts:41`  
  * **Severity**: P2  
  * **Remediation**: Skip unconfigured/stubbed providers in provider orchestrator.

* [ ] **BUG-025**: Fix SWR cache invalidation on competitor deletion.  
  * **Location**: `components/competitor-dashboard.tsx`  
  * **Severity**: P2  
  * **Remediation**: Trigger `mutate("/api/competitors")` immediately following competitor deletion.

* [ ] **BUG-026**: Decouple hardcoded Early Access paise amount check in Cashfree webhook.  
  * **Location**: `supabase/functions/cashfree-webhook/index.ts:105`  
  * **Severity**: P2  
  * **Remediation**: Validate payment amount against the specific `billing_payments` row amount rather than global static constant.

---

### Batch 4: UI/UX, Forms, Next.js 16 Params & Lint/Test Cleanup (P2 / P3)

* [ ] **BUG-027**: Resolve 40 ESLint errors and 17 warnings to restore clean lint baseline.  
  * **Locations**: `app/api/search/route.ts:511, 533, 554` and root test scripts.  
  * **Severity**: P3  
  * **Remediation**: Add explicit types to search payload normalization; clean up or ignore scripts.

* [ ] **BUG-028**: Disable or hide dead "Coming Soon" tabs in Settings Navigation.  
  * **Locations**: `components/settings-nav.tsx:12, 19, 20`  
  * **Severity**: P3  
  * **Remediation**: Add disabled styles and tooltips to Alerts, MCP, and API links.

* [ ] **BUG-029**: Migrate raw `<img>` tags to Next.js `<Image>` across ad cards and detail pages.  
  * **Locations**: `components/ad-card.tsx`, `components/brand-card.tsx`, `components/ad-detail.tsx`, `components/competitor-dashboard.tsx`  
  * **Severity**: P3  
  * **Remediation**: Use Next.js `<Image>` with configured image domains and blur placeholders.

* [ ] **BUG-030**: Populate descriptive accessibility `alt` attributes on all ad and avatar images.  
  * **Locations**: `components/video-preview.tsx:136`, `components/swipe-files-manager.tsx:213`, `components/sidebar.tsx:265`  
  * **Severity**: P3  
  * **Remediation**: Replace empty `alt=""` with contextual descriptions.

* [ ] **BUG-031**: Fix silent error swallowing in feedback API handler.  
  * **Location**: `app/api/feedback/route.ts:115`  
  * **Severity**: P3  
  * **Remediation**: Return structured error response when upstream feedback submission fails.

* [ ] **BUG-032**: Verify and enforce Next.js 16 Promise awaiting on `params` and `searchParams` across all dynamic routes.  
  * **Locations**: `app/**/[*]/page.tsx`  
  * **Severity**: P3  
  * **Remediation**: Ensure all dynamic routes declare `params: Promise<...>` and use `await params`.

---
*Generated by Antigravity Principal Staff Software Engineer & QA Architect.*

