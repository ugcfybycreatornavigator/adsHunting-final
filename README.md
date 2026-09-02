# Bucket Intelligence

A production-oriented Meta Ads intelligence workspace built with Next.js, TypeScript, Tailwind, Supabase, and a server-side SearchAPI provider.

## What works

- Live, debounced Meta Ad Library search through SearchAPI or an optional direct Meta `ads_archive` provider, with cursor pagination and a five-minute server cache
- Status, country, platform, media, CTA, duration, date, language, advertiser, and sort controls
- Normalized ad cards, lazy muted video previews, responsive detail drawer, and observable Winner Score
- Supabase Auth, normalized PostgreSQL schema, row-level security, indexes, and private Storage bucket
- Deduplicated saving, many-to-many swipe files, notes, tags, folder CRUD, saved search, competitor tracking, brands, and aggregate analytics
- Rights-aware media persistence: disabled by default, with validated server-side download/upload when explicitly enabled
- Resilient lifecycle model that requires three verified misses before an ad is marked inactive
- Optional Google Programmable Search brand enrichment with a separate, cached server route
- Safe integration health checks in Settings without returning credential values

## Setup

1. Copy `.env.example` to `.env.local` and enter your Supabase and SearchAPI values.
2. Apply both SQL files in `supabase/migrations` in filename order through the Supabase SQL editor or CLI.
3. In Supabase Auth, add `http://localhost:3000/auth/callback` and your production callback URL to allowed redirects.
4. Enable **Authentication → Emails → Custom SMTP** in Supabase. The restricted default sender is not suitable for application login.
5. For numeric email OTP login, update both **Confirm signup** and **Magic Link** under **Authentication → Email Templates**. Set their subjects to `Your Bucket login code` and use `supabase/templates/confirmation.html` and `supabase/templates/magic-link.html`, respectively. Both must contain `{{ .Token }}`; `{{ .ConfirmationURL }}` sends a link instead.
6. Install and run:

```bash
npm install
npm run dev
```

The app remains navigable in configuration mode when environment values are absent, but live search, auth, and permanent persistence require their respective services.

## Security notes

`SEARCH_API_KEY`, `SEARCH_API_KEY_1` through `SEARCH_API_KEY_4`, and `SUPABASE_SERVICE_ROLE_KEY` are referenced only by server modules. Never prefix them with `NEXT_PUBLIC_`. The creative bucket is private; saved-ad APIs verify ownership through RLS before issuing short-lived signed media URLs. Service-role use is limited to deduplicated catalogue upserts, archival writes, and those signed URLs.

Set `ALLOW_MEDIA_ARCHIVAL=true` only after confirming that your provider/platform agreement permits permanent copying. Otherwise Bucket stores the provider reference and normalized metadata without copying the asset.

`SEARCH_API_KEY` preserves the existing single-key integration. For production failover, set `SEARCH_API_KEY_1` through `SEARCH_API_KEY_4` (or provide a comma-separated `SEARCH_API_KEYS` value). Auto mode exhausts the available SearchAPI pool, then falls back to direct Meta and finally Foreplay. Direct Meta requires both `META_ACCESS_TOKEN` and an explicit `META_API_VERSION`; set `ADS_PROVIDER=meta` to force it. Google enrichment requires both `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` and never replaces Meta ad results.
