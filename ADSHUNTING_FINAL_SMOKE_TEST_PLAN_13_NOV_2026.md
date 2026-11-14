# AdsHunting — Final Production Smoke Test Plan

**Project:** AdsHunting (`adshunting.com`)  
**Date Prepared:** 13 November 2026  
**Execution Stage:** Post-Implementation Acceptance Verification  
**Status:** **READY FOR EXECUTION** (To be executed in a dedicated staging or production validation window)  
**Authors:** Principal Software Engineer, Senior Application Security Engineer, Senior QA Architect  

---

## 1. Objectives & Scope

This test plan defines the complete, step-by-step manual and automated verification procedure to be conducted before declaring AdsHunting ready for live customer traffic. It validates that all fixes deployed across Stages 1 through 4 function cohesively in an end-to-end user environment.

> [!IMPORTANT]
> **Execution Constraint:** This document is the execution blueprint. Do not execute destructive, live payment, or live marketing actions during local development. Run this plan sequentially during an authorized testing window.

---

## 2. Pre-Flight Checklist & Environment Configuration

Verify all required production environment variables are configured before initiating test procedures:

- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`: Active Clerk instance.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project (`ctvmjxpblfdrxvvyjebw`).
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: Configured strictly on server/edge environments.
- [ ] `CASHFREE_APP_ID` & `CASHFREE_SECRET_KEY`: Set to Cashfree production or sandbox credentials matching `CASHFREE_ENV`.
- [ ] `DEFTFORM_API_TOKEN`: Validated in server environment (not exposed in client bundle).
- [ ] `PLATFORM_OWNER_EMAIL`: Set to authorized platform administrator (`creatornavigator@gmail.com`).
- [ ] Remote Supabase Migrations: Migrations `20261113000000` through `20261113000007` verified in `supabase_migrations` table.

---

## 3. Test Personas & Account Setup

Prepare three distinct test accounts in Clerk:

| Persona | Role / Tier | Purpose |
| :--- | :--- | :--- |
| **Persona A: Free Explorer** | Unpaid User (0 credits) | Verify paywalls, credit prompts, rate limits, and upgrade flows. |
| **Persona B: Early Access Customer** | Paid User (Active ₹499/₹799 Tier) | Verify full search, swipe file organization, competitor tracking, and ad sharing. |
| **Persona C: Platform Owner** | `creatornavigator@gmail.com` | Verify platform administration badge, unconstrained access, and diagnostic views. |

---

## 4. End-to-End User Verification Journeys

### Journey 1: Public Marketing, Pricing & Documentation
- **Steps:**
  1. Open browser in incognito mode and navigate to `https://adshunting.com/`.
  2. Verify Hero section headline, CTA buttons, and responsive layout across desktop and mobile viewports.
  3. Navigate to `/pricing`.
  4. **Acceptance Criteria:**
     - Early Access Scout plan clearly displays ₹499/month (or ₹799/month Pro).
     - Confirm **zero** false claims of "7-day free trial" or "free trial" (`ISSUE-038`).
     - "Get Early Access" button initiates authenticated checkout path.
  5. Navigate to `/faq`.
  6. **Acceptance Criteria:**
     - Browser immediately 301-redirects to `/resources/help` (`ISSUE-007`).
     - FAQ items expand/collapse with accessible aria controls.

---

### Journey 2: Authentication & Concurrency Enforcement
- **Steps:**
  1. Sign in as Persona A on Browser 1 (e.g. Chrome).
  2. Verify redirection directly from `/sign-in` to `/discover` (no `/login` intermediate redirect, `ISSUE-006`).
  3. On Browser 2 (e.g. Firefox), sign in with identical credentials for Persona A.
  4. Return to Browser 1 and perform any navigation or API call.
- **Acceptance Criteria:**
  - Browser 2 becomes the active session.
  - Database function `activate_session_if_newer` records newest session.
  - Older session on Browser 1 is safely terminated without data corruption (`ISSUE-041`).

---

### Journey 3: Discover, Ad Search & Rate Limiting
- **Steps:**
  1. As Persona B (Paid), navigate to `/discover`.
  2. Enter keyword search query (e.g., "fitness sneakers") and filter by platform "Meta".
  3. Inspect HTTP network request for `POST /api/search` or `GET /api/ads/search`.
  4. Scroll down to trigger cursor-based pagination.
  5. Rapidly submit 25 consecutive search requests to test rate limiter.
- **Acceptance Criteria:**
  - `sessionId` is created on initial query and preserved across all cursor pagination requests (`ISSUE-034`).
  - Credit deduction is atomic: exactly 1 credit charged per distinct search session; subsequent cursor pages incur 0 duplicate credit deductions.
  - Winner Score displays algorithmic potential score (0–100) with accessible color themes.
  - Excessive requests trigger HTTP 429 with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` (`ISSUE-015`).
  - All creative thumbnails and advertiser logos render with descriptive `alt` text (`ISSUE-003`).

---

### Journey 4: Creative Library & Swipe Files
- **Steps:**
  1. Click the "Bookmark / Save" icon on any discovered ad creative.
  2. Open the Swipe File picker modal and select the default collection ("Saved Ads").
  3. Create a new custom folder named "Q4 E-Commerce Inspiration".
  4. Navigate to `/swipe-files`.
  5. Navigate to legacy `/saved` URL in address bar.
  6. Add custom tags ("high-converting", "ugc") to the saved ad.
  7. As Persona A (unauthorized), attempt to fetch or modify Persona B's folder via `PATCH /api/swipe-files/[id]`.
- **Acceptance Criteria:**
  - Default collection and custom folders display side-by-side in unified Creative Library (`ISSUE-025`).
  - `/saved` immediately 301-redirects to the default swipe file (`ISSUE-025`).
  - Tags persist and link to `swipe_file_items` foreign key (`ISSUE-037`).
  - Cross-tenant folder access is strictly blocked by RLS policies returning HTTP 403/404 (`ISSUE-031`, `ISSUE-032`).

---

### Journey 5: Competitor Tracking & Synchronization
- **Steps:**
  1. Navigate to `/competitors` (also verify `/brands` redirects to `/competitors`, `ISSUE-026`).
  2. Track a new advertiser (e.g., "Gymshark").
  3. Verify competitor dashboard displays active ad count and latest creative tiles.
  4. Trigger a manual sync for the tracked competitor.
  5. Navigate to competitor detail page `/competitors/[id]` (verify `/brands/[id]` redirects, `ISSUE-027`).
- **Acceptance Criteria:**
  - Active ads count uses server aggregate query without N+1 fetch loops (`ISSUE-018`).
  - Upstream provider synchronization enforces strict 8-second timeout; if upstream delays, UI displays clear retry notification without freezing (`ISSUE-035`).
  - Dynamic profile page renders brand metrics, top creatives, and activity timeline.

---

### Journey 6: Shared Ad Links & Public Collaboration
- **Steps:**
  1. In ad detail modal, click "Share Ad" to generate a public link.
  2. Copy generated share URL: `https://adshunting.com/share/[token]`.
  3. Inspect database: verify `shared_ads` stores SHA-256 `token_hash` (`ISSUE-016`).
  4. Open share URL in an unauthenticated incognito browser window.
  5. Toggle visibility to disabled in owner dashboard and reload incognito page.
- **Acceptance Criteria:**
  - Incognito view loads ad creative, headline, platform tags, and advertiser details in clean read-only presentation.
  - No raw secret token is stored in plaintext in the database (`ISSUE-016`).
  - Revoking or disabling visibility causes immediate HTTP 404 / "Creative Not Available" for external visitors.

---

### Journey 7: Cashfree Early Access Checkout & Webhook
- **Steps:**
  1. As Persona A (Free), click "Upgrade to Early Access" (₹499).
  2. Initiate checkout: verify Cashfree checkout modal opens using Cashfree SDK v3 (`ISSUE-020`).
  3. Complete payment in Cashfree Sandbox / Staging mode.
  4. Inspect database table `payments` and `credit_ledger`.
  5. Simulate / trigger Cashfree server webhook `POST /api/webhooks/cashfree`.
- **Acceptance Criteria:**
  - Order amount and payment amount strictly match ₹499.00 (`ISSUE-021`).
  - Cashfree webhook verifies cryptographic HMAC signature using raw request body (`ISSUE-024`).
  - Database finalization grants user access and credits idempotently: duplicate webhook deliveries do not double-grant credits (`ISSUE-024`).
  - Browser UI never grants entitlement until authoritative server verification completes.

---

### Journey 8: Settings, Team & Navigation Verification
- **Steps:**
  1. Navigate to `/settings`.
  2. Click on the "Alerts" navigation item (`ISSUE-001`).
  3. Navigate to `/settings/team`.
  4. Attempt to invite a teammate with email `teammate@example.com`.
- **Acceptance Criteria:**
  - "Alerts" tab is visually distinct with a "Soon" badge, shows disabled cursor, and does not navigate to broken placeholder (`ISSUE-001`).
  - On mobile viewport, "Alerts" in the dropdown select is marked disabled.
  - Team invitation executes legitimate server action; if unconfigured, returns clean user-facing error message without fake `setTimeout` mock success (`ISSUE-036`).

---

## 5. Security & Edge Resilience Checks

1. **Token Redaction Verification:**
   - Inspect all client-side network traffic in browser DevTools.
   - Confirm **zero** exposure of `DEFTFORM_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, or `CASHFREE_SECRET_KEY`.
2. **Missing Record Handling:**
   - Request non-existent entities: `/competitors/non-existent-id`, `/share/invalid-token-12345`.
   - Confirm application renders standard 404 UI without uncaught `PGRST116` fatal exceptions (`ISSUE-014`).
3. **Malformed Request Protection:**
   - Send malformed JSON (`{"query": `) to `POST /api/brands/search` and `POST /api/shared-ads/[id]/visibility`.
   - Confirm server safely responds with HTTP 400 Bad Request without crashing (`ISSUE-028`, `ISSUE-029`).

---

## 6. Sign-Off & Release Gate Criteria

The deployment is approved for general production availability when all of the following conditions are met:

| Verification Gate | Required Result | Verified By |
| :--- | :--- | :--- |
| **All 8 User Journeys** | 100% Pass without blocking defects | QA Lead |
| **Cashfree Financial Flow** | Exact amount verified; 0 duplicate grants | Billing Engineer |
| **Clerk + Supabase RLS** | Cross-tenant isolation confirmed | Security Lead |
| **Rate Limiter Stress** | Fail-closed on high-cost routes; 429 on abuse | DevOps / SRE |
| **Error Monitoring** | Sentry reports 0 unhandled exceptions | SRE Lead |

*Plan approved for staging execution by Principal Full-Stack & Security Engineering Leads.*
