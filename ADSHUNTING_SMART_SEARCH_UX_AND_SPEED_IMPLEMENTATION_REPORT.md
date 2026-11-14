# Smart Search UX and Speed Implementation Report

Date: 13 November 2026. Decision: **NO-GO for production; local implementation with incomplete runtime acceptance.**

## Scope and identity

Repository: /Users/rahulg/adsHunting 2. Branch main; base commit 4804d9e43325f86cea11b14e03cb4991cd4c374a. Candidate is an uncommitted worktree containing extensive prior Stage 1–4 work. This commit alone does not identify the candidate. No deployment, migration, payment, provider credential change or production mutation was performed.

The attached implementation request was read. The screenshot description was available; the image and two earlier recordings were NOT AVAILABLE for visual reproduction. Existing audit, code context, smoke/remediation and staging-closure reports informed investigation; their hosted results are historical evidence, not fresh verification. Installed Next.js route-handler documentation was consulted.

## Confirmed source findings

- The detached LayerStory chip was recent history, not an applied filter. Parent and autocomplete independently read the same unscoped browser key.
- Clearing the old input also called clearFilters, conflating unrelated actions.
- Old autocomplete only requested suggestions for two or more characters. Blank focus had no discovery brands.
- The route used the catalogue RPC, then fetched up to 1,000 heavy metadata records. A global metadata cap could omit some returned identities. Its fallback sampled ad rows before grouping, potentially concentrating results on one advertiser. These are confirmed mechanisms, **not a reproduced explanation of the recorded single-brand symptom**.
- Catalogue misses could invoke external providers while typing. These calls and the secondary metadata fetch are removed.
- The Discover error handler could apply an obsolete request's error; it now checks controller identity before changing state.

## Implementation and call graph

Input/focus → SearchAutocomplete → local recent terms and bounded session cache → GET /api/search/suggestions → existing entitlement and Clerk authentication → scoped Supabase client → existing get_search_suggestions RPC → compact brand metadata → dropdown.

Explicit Search/Enter after selection → existing Discover search/brand-search handlers → unchanged provider, persistence and usage paths.

Changed surfaces:

- components/search/search-autocomplete.tsx: 56px integrated search field, prominent Search action, clear-input action, rounded overlay, fixed-size logo/initials, recent/brand/filter headings, explicit selection-then-submit interaction, loading/error/retry/empty states.
- components/discover-experience.tsx: one account-scoped recent-history source, detached chips removed, labelled applied search and separate clear action, preserved filters when clearing input/search, obsolete-error guard.
- lib/search-suggestions.ts: validated five-term history, normalization, deduplication, exact/prefix ranking, name-token relevance and deterministic daily/account rotation.
- app/api/search/suggestions/route.ts: catalogue-only RPC, escaped SQL LIKE metacharacters, query length bound, sanitized errors, private/no-store responses, request ID and DB/total Server-Timing.
- tests/smart-search.test.ts: behavioral helper and mocked route coverage.

Typing uses 150ms debounce. In-flight work is aborted on changed query/close/unmount; a live-request guard excludes late completions. Suggestions have an eight-second client wait bound. Cache is component/account scoped, 30 entries, 60-second TTL; signed-in account changes remount the component. This cache is not a shared server cache.

## Semantics and provenance

Clear input changes only the draft. Clear search removes submitted query/brand, preserving other filters. Clear filters preserves submitted query/brand/view. Clear history and remove-one affect account-scoped local recents only. Browser storage denial does not fail a successful search. Ambiguous legacy global history is not imported.

Selection fills the field; the next Search/Enter deliberately submits. Arrow navigation alone does not search. Existing taxonomy categories remain selectable. Suggestions have no provider, persistence or usage calls.

Recent terms are labelled “this device.” Brand metadata comes from existing catalogue RPC fields; no followers are displayed because no reliable follower source was established. Logos are optional, fixed size, lazy-loaded, with initial fallback and no referrer.

Blank focus ranks up to 40 real catalogue candidates into eight suggestions; recents are deduplicated against these. Exact/name-token overlap with history boosts ranking. Remaining candidates rotate by account/day. This is limited lexical relevance, not a learned interest model; it cannot find related brands outside the RPC candidate pool. No category affinity, aliases, typo tolerance or follower enrichment is claimed.

## Security, billing and database boundaries

Entitlement and real authentication remain required. The existing catalogue RPC is SECURITY DEFINER and reads public catalogue metadata; using a scoped client does not transform that function into row-level enforcement. Its installed grants and behavior must be checked in staging. No private history is sent to this API.

New route test doubles expose only the catalogue RPC; successful and failed calls, escaped wildcard input, authentication denial and sanitized errors are exercised locally. This is not a hosted RLS or credit-ledger test.

The 15-credit new-search and 10-credit newly delivered-ad constants/accounting paths are unchanged. Existing regression tests pass, but cancellation/retry ledger safety is **not established**: the current Discover implementation creates a session ID for each non-append invocation. Timeout/retry reconciliation against the real ledger remains a release blocker; no billing policy was silently changed.

No migration was added. Prior migration 20261113000008 and provider blockers remain dependencies of the broader candidate according to the previous closure report, not freshly verified remote state.

## Performance evidence

| Path | Before | After | Verdict |
| --- | --- | --- | --- |
| Suggestions source shape | RPC + metadata fetch, optional providers | One catalogue RPC, no providers | Source-verified reduction; no runtime speed claim |
| Typed debounce | 250ms | 150ms | Configured delay only, not measured paint latency |
| Blank suggestions | No catalogue request | Up to 40 compact candidates | New functionality; blank RPC can aggregate the catalogue |
| Auth/DB/transport/render p50/p95 | Not measured this run | Not measured this run | BLOCKED |
| Default feed 500ms target | Historical report only | No comparable measurement | NOT VERIFIED |

The read-only database benchmark did not execute: automatic approval review returned a usage-limit error. Chromium launch also failed locally with SIGABRT/EPERM. No fabricated samples, screenshots, speedup percentages or 500ms pass are reported. The prior 2,530→1,522ms database-only benchmark is not an end-user baseline for this change.

The existing RPC aggregates and sorts catalogue rows even when its output is bounded. Staging EXPLAIN and cold/warm samples are required before recommending a schema change or claiming the blank path is fast.

## Validation and remaining acceptance

Executed commands: npm run typecheck; npm run lint; node --require ./tests/register-typescript.cjs --test tests/*.test.ts; git diff --check; npm run build. Final outcomes are recorded in the companion matrix.

Combobox roles, unique IDs, active descendant, IME Enter guard, Escape/outside/blur closing, status messages, 44px controls, viewport-constrained overlay and reduced-motion spinner are implemented. Mobile keyboard geometry, nested listbox controls, touch scrolling, focus restoration, contrast, screenshots and actual assistive-technology behavior remain unverified. No full accessibility pass is claimed.

Dedicated staging URL/project and authorized test personas were not supplied. Earlier project enumeration is not a current environment inventory. Provider health was not reprobed; no live Nike/LayerStory success is claimed. Firefox/WebKit, responsive widths 320–1920, slow network, two-tenant RLS, ledger/cancellation, authentication replacement and actual request/log correlation remain blocked.

Before promotion: identify staging, review an immutable artifact including existing changes, check RPC grants/schema and migration 08, run authenticated browser and ledger journeys, gather >=10 equivalent cold/warm timing samples, restore providers and observe real tracking success. Production requires explicit approval. **The full requested definition of done is not met.**
