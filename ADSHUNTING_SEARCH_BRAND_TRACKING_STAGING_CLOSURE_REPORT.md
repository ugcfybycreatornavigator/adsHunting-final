# AdsHunting Search and Brand Tracking Staging Closure Report

**Date:** 13 November 2026 (Asia/Kolkata)  
**Repository:** `/Users/rahulg/adsHunting 2`  
**Decision:** **NO-GO — no dedicated AdsHunting staging target, immutable deployment artifact, restored providers, or authenticated staging personas are available.**

## 1. Closure scope and safety boundary

This closure pass inspected the complete current worktree, reviewed migration `20261113000008_competitor_sync_started_at.sql`, enumerated accessible Supabase projects, inspected local deployment metadata, measured the target table size read-only, recalculated candidate identity, and reran every local quality gate.

No database migration, application deployment, provider credential change, payment, catalog mutation, or production data mutation was performed. The only accessible AdsHunting Supabase project is the linked production project, so a staging-only mutation would have been impossible without violating the request.

## 2. Candidate identity

| Identity element | Value |
|---|---|
| Git branch | `main` |
| Base commit | `4804d9e43325f86cea11b14e03cb4991cd4c374a` |
| Tracked diff SHA-256 | `fc7e992ca971b0322e5ff602de21a9821472d2beded413f0999cac37e866d93c` |
| Untracked-file manifest SHA-256 | `c8cb36ea6d7fd488d0f339e44e8efdc0a4d27d0f31379ac715b98ac1affdfe3a` |
| Changed/untracked path count | 112 |
| Deployment artifact | **NONE** — worktree is uncommitted |
| Deployment URL / release ID | **NONE** |

The hashes identify the inspected local state but are not a substitute for a reviewed commit and immutable deployment artifact. Deploying from this worktree would carry all 112 paths, not only the performance remediation.

## 3. Staging target discovery

`npx supabase projects list --output json` returned four accessible projects:

| Project | Reference | Role in this task |
|---|---|---|
| adsHunting | `ctvmjxpblfdrxvvyjebw` | Linked **production** project |
| Layerstory-Application | `gdrkxfaxkgpkqaulryub` | Unrelated; not usable |
| UGCFY | `lqyatdizmzqfmkvrpefe` | Unrelated; not usable |
| Digital Office | `jfevunsxtjakbcopkftp` | Unrelated; not usable |

No AdsHunting staging Supabase project exists in the accessible organization. No `.vercel` project metadata, staging URL, or alternative staging environment configuration exists in the workspace. The local `.env.local` points to a single environment and contains no staging-specific target.

**Result:** migration application and candidate deployment were **BLOCKED**, not attempted.

## 4. Migration `20261113000008` review

Migration contents:

```sql
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;

CREATE INDEX IF NOT EXISTS competitors_sync_started_at_idx
  ON public.competitors (sync_started_at)
  WHERE sync_status = 'syncing';
```

### Compatibility and security

- `sync_started_at` is nullable and has no default, so adding it is backward-compatible with existing inserts and old application versions.
- The column type matches application ISO timestamps and PostgreSQL time-zone semantics.
- Existing table-level privileges and RLS policies continue to govern the new column. No new GRANT is required or desirable.
- The application still scopes competitor mutation by both competitor UUID and authenticated `user_id`.
- The partial index contains only rows in `sync_status = 'syncing'` and supports the stale-lock recovery predicate.

### Lock and concurrency assessment

- Read-only production count: 7 competitor rows, 0 currently syncing.
- `ADD COLUMN` without a default is a metadata-only operation on PostgreSQL 17, though it briefly requires an `ACCESS EXCLUSIVE` table lock.
- Standard `CREATE INDEX` permits reads but can block writes while building. With seven rows, expected build time is negligible; staging must still be checked before production promotion.
- `IF NOT EXISTS` makes re-execution structurally safe, but it does not validate that a pre-existing same-named index has the intended definition. Post-apply verification must inspect the actual column type and index predicate.

### Rollback

Preferred application rollback: restore the previous application artifact and leave the nullable column/index in place. They are backward-compatible and harmless to the old release.

If schema rollback is explicitly required before any retained data depends on the column:

```sql
DROP INDEX IF EXISTS public.competitors_sync_started_at_idx;
ALTER TABLE public.competitors DROP COLUMN IF EXISTS sync_started_at;
```

This destructive schema rollback must be separately approved and executed in a controlled window. It was not executed here.

### Migration state

`npx supabase migration list --remote` shows:

- local `20261113000008`
- remote blank

The migration remains unapplied, as required by the production safety boundary.

## 5. Provider health and required operator actions

Latest read-only provider evidence remains:

| Provider / brand | Health | Required action |
|---|---|---|
| Meta / Nike | `META_TOKEN_EXPIRED`; historical `ads_archive` permission error also recorded | Generate/rotate a valid token for the intended Meta app/system user; confirm Ads Library access and `ads_archive` permission; update staging secrets only; run a read-only provider probe before sync |
| Meta / LayerStory | `META_TOKEN_EXPIRED` | Same token rotation and permission verification |
| SearchAPI / Nike | `SEARCHAPI_RATE_LIMIT` | Restore quota or wait for provider cooldown; confirm key health and plan limits |
| SearchAPI / LayerStory | All configured keys cooling down | Restore quota/cooldown and verify each configured key |

No provider security check, token validation, quota, or circuit breaker was bypassed. Provider-backed success cannot be claimed.

## 6. Required authenticated runtime matrix

The following tests require a real staging deployment, two or more authorized Clerk users, provider access, and staging credit-ledger data. They were not runnable in the current environment.

| Required test | Result | Blocking condition |
|---|---|---|
| Authenticated Nike refresh success | BLOCKED | No staging; Meta expired; SearchAPI limited |
| Authenticated LayerStory refresh success | BLOCKED | No staging; Meta expired; SearchAPI cooling down |
| Competitor provider failure state | BLOCKED | No staging deployment/persona |
| Provider timeout and stale recovery | BLOCKED | Migration unapplied; no staging |
| Concurrent retries / HTTP 409 | BLOCKED | No staging deployment/persona |
| Cross-tenant competitor UUID mutation | BLOCKED | No two staging users |
| Historical catalog preservation | PARTIAL | Source/regression and production read-only evidence pass; hosted mutation test blocked |
| Discover multi-brand searches | BLOCKED | No authenticated staging persona |
| New session vs cursor pagination | BLOCKED | No staging credit ledger |
| Rapid query changes / browser cancellation | BLOCKED | No authenticated staging browser |
| Clerk session replacement | BLOCKED | No second real Clerk session |
| API failure and retry | BLOCKED | No staging deployment |
| Search timeout and duplicate-charge audit | BLOCKED | No staging credit ledger |
| Mobile/tablet/desktop UI states | BLOCKED | No staging deployment/session |
| Request ID and `Server-Timing` capture | PASS in source/regression; runtime BLOCKED | Headers are implemented; no staging response |
| Application log correlation | BLOCKED | No staging release/log stream |

The billing implementation remains 15 credits for a genuinely new search and 10 credits for each newly delivered ad. Local tests cover the constants and atomic accounting path, but this closure does not claim hosted ledger verification.

## 7. Local verification executed in this closure pass

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0, zero warnings |
| `node --require ./tests/register-typescript.cjs --test tests/*.test.ts` | PASS, 84 passed, 0 failed |
| `git diff --check` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; Next.js 16.3.0; 58/58 static pages generated |
| `npx supabase projects list --output json` | PASS, read-only; no AdsHunting staging project found |
| Production competitor row count | PASS, read-only; 7 rows and 0 syncing |

No new application defect was established during this closure pass, so no additional implementation was introduced.

## 8. Deployment sequence required to unblock closure

1. Provision or identify a dedicated AdsHunting staging Supabase project. Do not use the production, LayerStory, UGCFY, or Digital Office project.
2. Provision or identify an AdsHunting staging application target and URL.
3. Configure staging-only Clerk, Supabase, Meta, SearchAPI, and monitoring credentials.
4. Supply at least two authorized Clerk staging personas with known credit balances.
5. Commit/review the intended candidate or otherwise produce an immutable artifact; record commit SHA and deployment ID.
6. Explicitly authorize migration `20261113000008` against the named staging project reference.
7. Apply and verify the migration in staging, including column type, index predicate, migration ledger, and RLS behavior.
8. Deploy the exact matching artifact to staging.
9. Restore provider access and execute every blocked runtime test above with request IDs, timings, logs, ledger deltas, and screenshots.
10. Only after all mandatory staging evidence passes may a separate production migration/deployment approval be requested.

## 9. Final decision

**NO-GO for production release and NO-GO for claiming staging closure.**

The local candidate passes all available engineering gates, and the migration is technically suitable for a controlled staging rollout. However, no AdsHunting staging infrastructure or immutable artifact exists, provider access is unhealthy, authenticated personas are unavailable, and the staging-only migration/deployment authorization lacks a concrete target. Production was correctly left unchanged.
