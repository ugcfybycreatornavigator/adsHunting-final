# AdsHunting Final Smoke Test Execution Report

**Execution date:** 13 November 2026 (Asia/Kolkata)  
**Repository:** `/Users/rahulg/adsHunting 2`  
**Release decision:** **INCOMPLETE — mandatory authenticated staging, payment, cross-browser, Lighthouse, and production-deployment verification could not be completed.**

## 1. Scope and evidence boundary

This run independently inspected the current dirty worktree, the final audit, the Stage 1–4 reports, the repository smoke-test plan, current source, local production build, browser-rendered public routes, the linked Supabase migration ledger, and non-mutating public production URLs.

The named mandatory file `ADSHUNTING_FINAL_SMOKE_TEST_MASTER_PROMPT_13_NOV_2026.md` is not present in the repository. `ADSHUNTING_FINAL_SMOKE_TEST_PLAN_13_NOV_2026.md` was present and executed where the available environment allowed. No deployment, migration, real payment, production data mutation, or load test was performed.

The worktree contained extensive pre-existing uncommitted Stage 1–4 changes. They were preserved. This execution added only two confirmed smoke-test corrections, regression coverage, a reusable browser-smoke script, whitespace cleanup, and these reports.

## 2. Final results

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck`, exit 0 |
| ESLint | PASS | `npm run lint`, exit 0, zero warnings |
| Automated tests | PASS | `node --require ./tests/register-typescript.cjs --test tests/*.test.ts`, 78 passed, 0 failed |
| Stage 1–3 regressions | PASS locally | Included in the 78-test suite; behavioral tests are synthetic/local, not a substitute for hosted multi-tenant journeys |
| Diff formatting | PASS after correction | `git diff --check`, exit 0 |
| Next.js production build | PASS | `npm run build`, Next.js 16.3.0, 58/58 static pages generated, exit 0 |
| Local HTTP public routes | PASS with one corrected defect | `/`, `/about`, `/pricing`, `/contact`, `/resources/help` returned 200 |
| Local auth boundary | PASS (unauthenticated) | `/discover`, `/settings`, `/saved`, `/brands` redirected to sign-in |
| Local invalid share | PARTIAL PASS | `/share/invalid-token-12345` rendered the unavailable-state page with HTTP 200; semantic 404 was not returned |
| Responsive Chromium | PASS for tested public routes after correction | `/`, `/pricing`, `/resources/help`, `/contact` at 320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920 px |
| Firefox / WebKit | BLOCKED | Playwright package exists, but browser executables are not installed |
| Accessibility | PARTIAL PASS | Rendered pages had one `h1`, no unlabeled buttons, no images missing `alt`, no console/page exceptions; no full axe/WCAG or manual keyboard/contrast audit |
| Performance | PARTIAL / NOT CORE WEB VITALS | Navigation timings collected locally; Lighthouse, LCP, INP and CLS were not measured |
| Supabase migration ledger | PASS | Read-only linked production ledger shows local=remote for `20260908120000` and `20261113000000` through `20261113000007` |
| Production public HTTP | PARTIAL PASS | `/`, `/pricing`, `/resources/help` returned 200 |
| Production release parity | FAIL / deployment pending | Production `/faq` still returns 307 to sign-in; corrected local build returns 308 to `/resources/help` |
| Authenticated journeys | BLOCKED | No prepared Clerk personas/session credentials supplied |
| Cashfree sandbox flow | BLOCKED | No authorized sandbox payment window or test persona supplied |
| Hosted RLS/IDOR journey | BLOCKED | No two authorized hosted tenant personas supplied |

## 3. Rendered responsive and accessibility evidence

Chromium rendered four public routes at every required width with reduced-motion enabled. After the corrective patch:

- All 40 route/width combinations returned 200.
- No horizontal document overflow remained.
- No browser console errors or uncaught page exceptions were observed.
- Each page had exactly one `h1`.
- The basic DOM audit found zero unlabeled buttons and zero `img` elements missing `alt`.
- Local `DOMContentLoaded` observations were approximately 462–1,383 ms; `load` observations were approximately 785–2,755 ms. These are local navigation timings, not Lighthouse scores or field Core Web Vitals.

Authenticated dashboards, tables, search filters, dialogs, billing, Swipe Files, saved ads, and team UI were not rendered because no authorized authenticated test session was available. They therefore remain **NOT RUN**, not passed.

## 4. Defects found and corrected

### FST-001 — Public FAQ legacy route intercepted by authentication

**Reproduction:** Local production build returned `307` from `/faq` to `/sign-in?.../faq`; production does the same.  
**Root cause:** The redirect lived in `app/(workspace)/faq/page.tsx`, below the workspace authentication layout.  
**Correction:** Added a permanent request-level redirect in `next.config.mjs`, which Next.js evaluates before filesystem rendering.  
**Regression:** `tests/final-smoke-regressions.test.ts`.  
**Retest:** Local rebuilt release returns `308 Permanent Redirect` with `Location: /resources/help`. Production remains unchanged until an operator-approved deployment.

### FST-002 — Homepage horizontal overflow at desktop/tablet widths

**Reproduction:** Chromium measured document widths 1088/1024, 1364/1280, and 1444/1440 at 1024, 1280, and 1440 px.  
**Root cause:** The desktop Workflow artwork uses a negative right margin and escaped its section boundary.  
**Correction:** Added `overflow-x-clip` to the Workflow section only, preserving the intended composition.  
**Regression:** Static assertion plus rendered retest.  
**Retest:** Exact `scrollWidth === clientWidth` at 1024, 1280, and 1440; no page exceptions.

### FST-003 — Dirty diff whitespace

**Reproduction:** `git diff --check` reported trailing whitespace and an extra EOF blank line in existing Stage changes.  
**Correction:** Whitespace-only cleanup in the reported files.  
**Retest:** `git diff --check`, exit 0.

## 5. Security, billing, and database regression

Local tests verify the implemented boundaries for Clerk-to-Supabase scoped clients, swipe-file ownership, platform-owner fail-closed behavior, Svix raw-body verification, hashed share tokens, Cashfree authoritative verification and idempotent finalization, distributed rate limiting, malformed JSON handling, historical-ad identity, and bounded ingestion.

Source verification confirms `CREDIT_COSTS.AD_SEARCH = 15`, `BRAND_SEARCH = 15`, and `AD_DELIVERED = 10`; the search route applies base cost only for a genuinely new search and delivery cost through the atomic usage function. This is source/test evidence only. Hosted concurrent billing and duplicate-webhook behavior were not executed with synthetic staging data in this run.

The linked production migration ledger reports all relevant local migrations through `20261113000007` as present remotely. No migration was applied or modified by this execution.

## 6. Mandatory journeys not run

The following remain mandatory before release approval:

1. Three-persona Clerk sign-up/sign-in/onboarding and concurrent-session journey.
2. Paid Discover search, cursor pagination, 15-credit new-search charge, 10-credit newly delivered-ad charge, retry/refresh/back-navigation, and live 429 headers.
3. Cross-tenant Swipe File, tag, shared-link, competitor, and team authorization attempts against staging.
4. Cashfree sandbox checkout, amount verification, duplicate webhook delivery, ledger inspection, and entitlement confirmation.
5. Authenticated responsive, keyboard, focus, contrast, dialog, table, image/video, slow-network, and retry checks.
6. Firefox and WebKit rendered coverage.
7. Lighthouse and real LCP/INP/CLS measurement; production monitoring/Sentry review.
8. Deployment of the corrected release followed by production parity and rollback checks.

## 7. Deployment compatibility and rollback

The corrected source passes the complete local suite and Next.js production build. It has not been deployed. Deploy only through the normal operator-approved release process. Verify the artifact/commit, environment configuration, Clerk JWT template, Supabase project target, Cashfree environment, and Sentry release before promotion.

Rollback should restore the previous application artifact without rolling back the already-applied additive database migrations unless a separately reviewed database rollback is required. Re-run public route checks, authentication, billing verification, and migration-ledger checks after either deploy or rollback.

## 8. Acceptance decision

**INCOMPLETE — Mandatory verification could not be performed.**

The local candidate is materially healthier and passes all available local gates, but production is not yet running the corrected candidate and critical authenticated, financial, tenant-isolation, cross-browser, accessibility, and Core Web Vitals journeys lack actual runtime evidence.
