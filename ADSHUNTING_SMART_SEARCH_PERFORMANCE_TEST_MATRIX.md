# Smart Search Performance Test Matrix

Date: 13 November 2026. Local tests are distinct from live staging verification.

| Case/input | Expected | Type | Actual evidence/status |
| --- | --- | --- | --- |
| Invalid, duplicate, Unicode, 20 stored terms | Sanitized, normalized, max five recents | Behavioral | PASS; tests/smart-search.test.ts |
| Two account IDs | Different storage namespaces | Behavioral | PASS; not a browser cross-account test |
| Exact/prefix name and duplicate casing | Exact first, unique names | Behavioral | PASS |
| Same/different day seeds, 40 candidates | Stable order and diverse rotated list | Behavioral | PASS |
| Nike Running/Nike, Café Studio/Café, unrelated names | Only real significant-token overlap | Behavioral | PASS |
| Authenticated suggestions with SQL wildcard characters | One escaped catalogue RPC, no usage/provider calls | Mocked route integration | PASS |
| RPC error/private diagnostic | Sanitized 503 | Mocked route integration | PASS |
| Anonymous request | 401 without database query | Mocked route integration | PASS |
| Successful response | Request ID, DB/total timing, private/no-store | Mocked route integration | PASS |
| TypeScript | No errors | npm run typecheck | PASS, exit 0 |
| ESLint | Zero warnings/errors | npm run lint | PASS, exit 0 |
| All regression suites | No failures | node --require ./tests/register-typescript.cjs --test tests/*.test.ts | PASS, 90 tests; local/synthetic evidence |
| Formatting | No whitespace errors | git diff --check | PASS, exit 0 |
| Production compilation | Successful build | npm run build | PASS, exit 0; 58/58 generated pages |
| Chromium launch | Browser starts | playwright-core using installed Chrome | BLOCKED; SIGABRT/EPERM before page creation |
| Before/after UI screenshots | Visible desktop/mobile redesign | Browser | NOT RUN; no screenshots claimed |
| All widths 320–1920, soft keyboard, touch, Firefox/WebKit | No clipping, usable focus/scroll | Browser | NOT RUN |
| Rapid input, abort, stale response, IME, clear actions | Correct interactive state | Browser | NOT RUN; guards implemented but runtime acceptance pending |
| Real two-tenant auth/RLS/history isolation | No unauthorized disclosure/mutation | Hosted | BLOCKED; no staging personas |
| 15/10-credit ledger, timeout/retry, pagination | Exact legitimate charges, no duplicate charge | Hosted | BLOCKED; existing session retry behavior requires reconciliation |
| Nike/LayerStory/provider failure/success | Truthful real outcomes and preserved history | Hosted | NOT RUN; provider health not freshly verified |
| Default feed/autocomplete p50/p95, 10–30 equivalent samples | Comparable real end-to-end timings | Hosted/browser | BLOCKED; read-only benchmark approval review usage limit |
| 500ms target | Measured representative success | Performance | NOT VERIFIED |

Local command logs: /tmp/adshunting-smart-tests.log and /tmp/adshunting-smart-build.log (temporary local artifacts). No hosted timing distributions or browser durations are available. Pure ranking test duration is not user-facing latency.

Production decision: **NO-GO** pending runtime, billing, provider and deployment evidence described in the implementation report.
