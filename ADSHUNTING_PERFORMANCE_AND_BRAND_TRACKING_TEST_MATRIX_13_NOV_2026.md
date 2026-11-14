# AdsHunting Performance and Brand Tracking Test Matrix

**Date:** 13 November 2026  
**Candidate:** Current local dirty worktree; not deployed

| Area | Test | Environment | Result | Evidence / blocker |
|---|---|---|---|---|
| Artifacts | Read mandatory remediation prompt | Repository/attachments | BLOCKED | Named file absent |
| Artifacts | Review both recordings | Attachments | BLOCKED | Recordings absent |
| Discover UI | Replaced session settles request | Automated source regression | PASS | Throws `SessionReplacedError`; no never-settling promise |
| Discover UI | Stale response cannot overwrite newer search | Automated source regression | PASS | Controller identity guard |
| Discover UI | Hung search exits Searching | Automated source regression | PASS | 35-second abort and `SEARCH_TIMEOUT` state |
| Discover API | Default feed fetch bound | Source + database benchmark | PASS | 120 rows maximum per initial sample |
| Discover API | Request correlation | Automated regression | PASS | `X-Request-Id` response header |
| Discover API | Total server timing | Automated regression | PASS | `Server-Timing: total;dur=...` |
| Discover DB | Old 1,000-row query | Production, read-only, 5 runs | MEASURED | Median 2,530 ms; ~5.60 MB median JSON |
| Discover DB | New 120-row query | Production, read-only, 5 runs | MEASURED | Median 1,522 ms; ~1.32 MB median JSON |
| Discover DB | Performance delta | Calculated from real runs | PASS | 39.8% faster median; ~76% lower transfer |
| Discover billing | 15-credit new-search rule | Automated regression/source | PASS | Constants and atomic usage path unchanged |
| Discover billing | 10-credit newly delivered-ad rule | Automated regression/source | PASS | Constants and accepted-ad filtering unchanged |
| Discover billing | Real authenticated ledger entries | Staging browser + DB | BLOCKED | No authenticated test persona/session |
| Discover provider | Nike Meta search | Configured provider, read-only | FAIL EXTERNAL | Token expired, 543 ms |
| Discover provider | Nike SearchAPI search | Configured provider, read-only | FAIL EXTERNAL | Rate limit, 861 ms |
| Discover provider | LayerStory Meta search | Configured provider, read-only | FAIL EXTERNAL | Token expired, 305 ms |
| Discover provider | LayerStory SearchAPI search | Configured provider, read-only | FAIL EXTERNAL | Keys cooling down, 0 ms |
| Competitors DB | Schema check for `updated_at` | Production, read-only | FAIL CONFIRMED | `42703`, column does not exist |
| Competitors DB | Explicit `sync_started_at` migration | Local migration source | PASS LOCAL | Version `20261113000008` prepared |
| Competitors DB | Migration applied remotely | Production ledger | NOT APPLIED | Local `20261113000008`, remote blank |
| Competitors UI/API | Retry uses competitor UUID | Automated regression | PASS | `brand.competitorId` sent to PATCH |
| Competitors security | Ownership remains enforced | Source + Stage regressions | PASS LOCAL | UUID lookup includes authenticated `user_id` |
| Competitors state | Old record not instantly marked stale | Automated regression | PASS | Uses only `sync_started_at` |
| Competitors state | Provider failure preserves history | Automated regression + DB evidence | PASS LOCAL | No `ads_count: 0` overwrite |
| Nike data | Indexed catalog availability | Production, read-only | PASS | 132 ads indexed |
| LayerStory data | Indexed catalog availability | Production, read-only | PASS | 29 ads indexed |
| Media | Existing competitor previews preserved | Source/data review | PASS LOCAL | Historical ads untouched; signed preview path unchanged |
| Media | Real authenticated rendered previews | Staging browser | BLOCKED | No authenticated Clerk session |
| Security | Cross-tenant competitor mutation | Automated/source | PASS LOCAL | Route scopes row by UUID + user ID |
| Security | Hosted cross-tenant attempt | Staging | BLOCKED | No two authorized personas |
| Regression | Remediation tests | Local | PASS | 6/6 |
| Regression | Full tests | Local | PASS | 84/84 |
| Regression | TypeScript | Local | PASS | Exit 0 |
| Regression | ESLint | Local | PASS | Exit 0, zero warnings |
| Regression | Diff formatting | Local | PASS | Exit 0 |
| Regression | Production build | Local | PASS | Next.js 16.3.0, 58/58 static pages |
| Browser | Preview-auth Discover | Local production build | BLOCKED | HTTP 500: Clerk cannot detect middleware when bypass proxy is active |
| Browser | Real authenticated Discover | Staging | NOT RUN | Credentials/session unavailable |
| Browser | Nike Retry success path | Staging | NOT RUN | Migration/deployment/provider repair required |
| Browser | LayerStory Retry success path | Staging | NOT RUN | Migration/deployment/provider repair required |
| Production | Application deployment | Production | NOT RUN | Explicit approval not granted |
| Production | Database migration | Production | NOT RUN | Explicit approval not granted |

## Required acceptance rerun

After provider repair and operator-approved staging migration/deployment, capture:

1. Discover initial feed and keyword/brand search request IDs, `Server-Timing`, UI settle time, result count, and media settle time.
2. Rapid consecutive searches proving stale responses cannot replace the newest query.
3. Session replacement proving Searching exits into the session-replaced flow.
4. Nike and LayerStory Retry success and failure paths, including exact provider code and preserved historical previews.
5. Duplicate Retry / concurrent sync behavior and stale-lock recovery after two minutes.
6. Credit ledger deltas for new search, pagination, retry, duplicated delivery IDs, and insufficient-credit response.
7. Cross-tenant competitor UUID mutation denial.

No production GO claim is permitted until these authenticated staging rows change from BLOCKED/NOT RUN to evidence-backed PASS.
