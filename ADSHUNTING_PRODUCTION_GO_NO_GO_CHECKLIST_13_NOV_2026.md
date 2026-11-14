# AdsHunting Production Go / No-Go Checklist

**Date:** 13 November 2026  
**Current recommendation:** **INCOMPLETE — do not approve general production release yet.**

## Verified release gates

- [x] Full TypeScript typecheck passes.
- [x] Full ESLint passes with zero warnings.
- [x] All available automated tests pass: 78/78.
- [x] Stage 1–3 local regression tests pass.
- [x] `git diff --check` passes.
- [x] Next.js 16.3.0 production build passes; 58/58 static pages generate.
- [x] Credit constants remain 15 per genuinely new ad/brand search and 10 per newly delivered ad.
- [x] Linked production Supabase ledger contains migrations through `20261113000007` with no local/remote gaps.
- [x] Public Chromium routes tested at all required widths after correction.
- [x] Corrected local `/faq` permanently redirects to `/resources/help`.
- [x] Corrected homepage no longer has horizontal overflow at affected widths.
- [x] No deployment, migration, real payment, production mutation, or uncontrolled load test was performed.

## Blocking approval conditions

- [ ] Commit/review the current dirty Stage 1–4 worktree and identify the exact release artifact.
- [ ] Operator-approved staging deployment of that exact artifact.
- [ ] Run all eight smoke-plan journeys with authorized Free, Early Access, and Platform Owner personas.
- [ ] Verify hosted Clerk/Supabase tenant isolation with two distinct accounts.
- [ ] Verify 15-credit new-search and 10-credit newly delivered-ad accounting under pagination, retries, concurrency, and duplicate requests.
- [ ] Complete Cashfree sandbox checkout and duplicate-webhook idempotency test without real payment.
- [ ] Exercise authenticated responsive routes at 320–1920 px.
- [ ] Complete keyboard, focus, labels, contrast, reduced-motion, and full automated accessibility audit.
- [ ] Install/run Firefox and WebKit browser coverage.
- [ ] Run Lighthouse or equivalent lab measurements for LCP/CLS; run interaction testing for INP. Do not treat local navigation timing as Core Web Vitals.
- [ ] Review Sentry/runtime logs during the staging window.
- [ ] Deploy with explicit operator approval only.
- [ ] Confirm production `/faq` returns 308 to `/resources/help`; it currently returns 307 to sign-in.
- [ ] Re-run production public, auth, billing, sharing, and rollback smoke tests after deployment.

## Deployment sequence

1. Freeze and review the intended diff; ensure no unrelated user changes are lost.
2. Record commit SHA, build artifact, environment target, and database project reference.
3. Confirm required Clerk, Supabase, Cashfree, Deftform, platform-owner, and Sentry variables without printing secrets.
4. Deploy the exact candidate to staging and execute every blocker above.
5. If all mandatory journeys pass, obtain explicit production authorization.
6. Deploy the same reviewed artifact to production; do not apply migrations unless a new reviewed migration exists.
7. Verify route parity, authenticated journeys, credit ledger, webhook processing, logs, and error rates.

## Rollback plan

- Keep the immediately previous application artifact available.
- On critical auth, billing, tenant-isolation, search, or rendering regression, stop promotion and restore the previous application artifact.
- Do not destructively roll back the currently applied additive Supabase migrations as part of an application rollback.
- Pause affected payment/search entry points if financial correctness is uncertain.
- After rollback, verify public routes, sign-in, tenant isolation, search accounting, webhook idempotency, and monitoring before reopening traffic.

## Open risks

- Production does not yet include the two smoke-test corrections.
- Authenticated runtime behavior is unverified in this execution.
- Payment and credit behavior is verified by source/tests, not an actual sandbox journey.
- Firefox/WebKit, full accessibility, and Core Web Vitals evidence are absent.
- The requested master prompt file is absent; only the repository smoke plan was available.
- The worktree remains large and uncommitted, increasing artifact-selection and rollback risk.

## Final decision

**INCOMPLETE — Mandatory verification could not be performed.**

Change this decision only after every blocking approval condition has current, captured evidence from the exact release artifact in authorized staging and after production parity is verified following explicit deployment approval.
