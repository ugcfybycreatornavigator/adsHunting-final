# PROJECT_DESCRIPTION.md — adshunting.com (`adsHunting-final`)

---

## 1. Executive Summary & Domain Logic

### 1.1 Core Purpose & Primary User Personas
`adshunting.com` (internally designated as `adsHunting-final`, formerly developed under the project codename `Bucket Intelligence` / `Bucket`) is a production-grade Meta Ads intelligence, competitive research, and creative swipe file platform. The system ingests, normalizes, deduplicates, and analyzes advertising creatives from Meta's platforms (Facebook, Instagram, Messenger, Audience Network, and Threads).

#### Primary User Personas
1. **Performance Marketers & Media Buyers**: Identify top-performing creative angles, formats (image vs. video vs. carousel), active hooks, and longevity patterns across competitors to optimize customer acquisition costs (CAC) and return on ad spend (ROAS).
2. **Creative Strategists & Copywriters**: Deconstruct winning competitor ad copy (headlines, primary text, descriptions, call-to-action buttons) and catalog visual hooks and offer structures for creative briefing.
3. **Agencies & Creative Teams**: Organize client and competitor ads into shared Swipe Files, generate time-stamped client presentation share links with granular permission controls, and track competitor campaign rollouts.
4. **Brand Founders & E-commerce Operators**: Monitor competitor launch tempos, new product tests, running duration, and market footprint without requiring access to private ad account analytics.

---

### 1.2 End-to-End Data Flow

```
[ User Search Request ]
        │
        ▼
[ Next.js Edge / Server Route: /api/search or Supabase Edge Function: ads-search ]
        │
        ├─► 1. Authentication (Clerk JWT via auth() / verifyClerkToken)
        ├─► 2. Entitlement & Credit Check (getWorkspaceEntitlement + report_search_and_delivery_usage)
        │      (15 credits deducted for base search query)
        │
        ▼
[ AdsProviderOrchestrator ]
        │
        ├─► Multi-Provider Circuit Breaker (5 failures, 30s cooldown, 8s budget per provider)
        ├─► 1. Meta Graph API (Official Ad Library API via ads_archive)
        ├─► 2. Foreplay API (public.api.foreplay.co)
        ├─► 3. SearchAPI (Meta Ad Library scraper with multi-key rotation pool)
        └─► 4. Spyglass API (app.spyglass.so/api/v1) [MetaAPI.io stubbed]
        │
        ▼
[ Ingestion & Normalization: refineAd() ]
        │
        ├─► Uniform RefinedAd / NormalizedAd schema mapping
        ├─► URL sanitization & tracking parameter stripping (fbclid, utm_*)
        ├─► Media format classification (image, video, carousel, unknown)
        └─► Deterministic SHA-256 fingerprinting (computeAdFingerprints)
              - creativeFingerprint: sha256(advertiser + mediaUrl + headline + body)
              - creativeGroupId: group_sha256(advertiser + mediaUrl)
              - canonicalAdId: canon_sha256(creativeFingerprint)
        │
        ▼
[ Signal Intelligence Engine: calculateWinnerScore() ]
        │
        ├─► Longevity Score (0-100 logarithmic: ln(1 + runningDays) / ln(1 + 120))
        ├─► Repetition Score (related creative count)
        ├─► Variant Iteration Score (active variants)
        ├─► Brand Commitment, Recency, Click Propensity, Conversion Potential
        └─► Weighted Winner Score (0-100) + Badge Assignment
        │
        ▼
[ Persistence & Catalog Storage: persistNormalizedAds() ]
        │
        ├─► Upsert into PostgreSQL public.ads table via Supabase admin service_role
        ├─► Provider ID array merging (provider_ad_ids) & observation count increment
        ├─► Inactive ad reconciliation (mark_verified_missing_ads RPC)
        ├─► Deduct Delivery Credits: 10 credits per ad delivered via report_search_and_delivery_usage
        └─► Background Media Archival via Next.js after() hook (if ALLOW_MEDIA_ARCHIVAL=true)
              - Downloads media asset (up to 50MB) to Supabase Storage bucket: ad-creatives
              - Rewrites media references to signed URLs via signArchivedAdMedia (1 hr TTL)
        │
        ▼
[ Client Rendering ]
        └─► Responsive grid, video previews, detail drawer, swipe file actions, brand profile
```

---

### 1.3 External Third-Party APIs, Scrapers, Payment Gateways & Webhooks

| External Integration | Integration Type | Mechanism / Endpoint | Codebase Location |
| :--- | :--- | :--- | :--- |
| **Clerk** | Authentication & Identity | `@clerk/nextjs` App Router middleware, JWT verification, Svix webhook | `proxy.ts`, `lib/auth.ts`, `app/api/webhooks/clerk/route.ts` |
| **Supabase** | DB, Storage & Edge Functions | PostgreSQL, Storage API, Deno Edge Functions | `lib/supabase/*`, `supabase/functions/*` |
| **Cashfree Payments** | Payment Gateway | PG Orders API `2023-08-01`, One-Click-Checkout (OCC), HMAC-SHA256 webhooks | `supabase/functions/_shared/cashfree.ts`, `supabase/functions/cashfree-webhook/` |
| **SearchAPI** | Meta Ad Library Scraper | Multi-key pooled HTTP client (`https://www.searchapi.io/api/v1/search`) | `lib/providers/searchapi.ts`, `supabase/functions/_shared/ads/providers/searchapi.ts` |
| **Meta Graph API** | Official Ad Library | Graph API `ads_archive` endpoint with app access token | `lib/providers/meta.ts`, `supabase/functions/_shared/ads/providers/meta.ts` |
| **Foreplay** | Creative Ad Spy API | REST client (`https://public.api.foreplay.co`) | `lib/providers/foreplay.ts`, `supabase/functions/_shared/ads/providers/foreplay.ts` |
| **Spyglass** | Ad & Brand Intelligence | REST client (`https://app.spyglass.so/api/v1`) | `lib/providers/spyglass.ts`, `supabase/functions/_shared/ads/providers/spyglass.ts` |
| **Google Custom Search** | Brand Discovery Enrichment | Programmable Search Engine API (`https://customsearch.googleapis.com/customsearch/v1`) | `lib/providers/google-search.ts`, `app/api/search/google/route.ts` |
| **Deftform** | User Feedback Webhook | Form response submission endpoint (`https://deftform.com/api/v1/forms/mMbYhG/response`) | `app/api/feedback/route.ts` |
| **Sentry** | Observability & Tracing | `@sentry/nextjs` error tracking, performance tracing, session replay | `instrumentation.ts`, `instrumentation-client.ts`, `sentry.*.config.ts` |
| **Razorpay** | Legacy Payment Gateway | Subscriptions & payments schema (superseded by Cashfree in commit `894c846a`) | `supabase/migrations/202608190001_billing_subscriptions.sql` |

---

## 2. Tech Stack & Exact Dependencies

### 2.1 Technology Architecture
- **Frontend Framework**: Next.js `16.3.0` (React `19.2.8`, React DOM `19.2.8`).
- **Routing Model**: Next.js App Router with Route Groups:
  - `app/(activation)`: Onboarding and Early Access Cashfree checkout.
  - `app/(marketing)`: Public landing, product demos, resources, and legal pages.
  - `app/(workspace)/(paid)`: Protected workspace routes requiring active subscription or Early Access entitlement (`dashboard`, `discover`, `brands`, `competitors`, `analytics`, `saved`, `shared-ads`, `swipe-files`).
  - `app/(workspace)/settings`: User settings, API status, team management, and billing management.
- **State Management**:
  - `swr` (`^2.5.1`): Client-side data fetching, caching, and cache revalidation.
  - React Context: `CreditsContext.tsx` (workspace credit balance tracking) and `support-context.tsx`.
  - URL Query State: `use-url-filters.ts` and `filter-utils.ts` for deep-linkable search filter states.
- **UI & Styling**: Tailwind CSS (`^3.4.17`), `tailwind-merge` (`^3.6.0`), `clsx` (`^2.1.1`), `lucide-react` (`^0.468.0`), `framer-motion` (`^13.1.0`), `@clerk/ui` (`^1.32.2`).
- **Backend Runtimes**:
  - **Node.js** (Next.js server-side Route Handlers and Server Actions).
  - **Deno** (`std@0.168.0` / Deno 1.x/2.x) for Supabase Edge Functions (`supabase/functions/*`).
- **Database & Storage**:
  - **Primary Database**: Hosted Supabase PostgreSQL (Postgres 15+).
  - **Database Access**: `@supabase/supabase-js` (`^2.49.4`), `@supabase/ssr` (`^0.6.1`), and direct PostgreSQL PL/pgSQL RPCs.
  - **Object Storage**: Supabase Storage (`ad-creatives` bucket for creative media archival; `support-attachments` bucket for user feedback attachments).
- **Background Jobs**:
  - Next.js 16 `after(...)` lifecycle callback in `app/api/search/route.ts` for asynchronous media archival without delaying search responses.
  - Sentry Webpack Vercel Monitor automation (`automaticVercelMonitors: true`).

---

### 2.2 Full Dependency Dump

#### Root `package.json`
```json
{
  "name": "adshunting",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@clerk/nextjs": "^7.7.4",
    "@clerk/ui": "^1.32.2",
    "@sentry/nextjs": "^10.73.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.49.4",
    "clsx": "^2.1.1",
    "dotenv": "^17.4.2",
    "framer-motion": "^13.1.0",
    "lucide-react": "^0.468.0",
    "next": "^16.3.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "svix": "^1.99.1",
    "swr": "^2.5.1",
    "tailwind-merge": "^3.6.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "autoprefixer": "^10.4.21",
    "clerk": "^3.0.1",
    "eslint": "^9.39.5",
    "eslint-config-next": "^16.3.0",
    "playwright-core": "^1.62.1",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.2"
  }
}
```

#### Supabase Edge Function Import Map (`supabase/functions/test-cashfree/deno.json`)
```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@^2",
    "@supabase/server": "npm:@supabase/server@^1"
  }
}
```

#### Deno Lockfile Root Dependency Scope (`deno.lock`)
```json
{
  "version": "5",
  "remote": {
    "https://deno.land/std@0.208.0/dotenv/mod.ts": "039468f5c87d39b69d7ca6c3d68ebca82f206ec0ff5e011d48205eea292ea5a6"
  },
  "workspace": {
    "packageJson": {
      "dependencies": [
        "npm:@clerk/nextjs@^7.7.4",
        "npm:@clerk/ui@^1.32.2",
        "npm:@sentry/nextjs@^10.73.0",
        "npm:@supabase/ssr@~0.6.1",
        "npm:@supabase/supabase-js@^2.49.4",
        "npm:@types/node@^22.13.10",
        "npm:@types/react-dom@^19.2.4",
        "npm:@types/react@^19.2.18",
        "npm:autoprefixer@^10.4.21",
        "npm:clerk@^3.0.1",
        "npm:clsx@^2.1.1",
        "npm:dotenv@^17.4.2",
        "npm:eslint-config-next@^16.3.0",
        "npm:eslint@^9.39.5",
        "npm:framer-motion@^13.1.0",
        "npm:lucide-react@0.468",
        "npm:next@^16.3.0",
        "npm:playwright-core@^1.62.1",
        "npm:postcss@^8.5.3",
        "npm:react-dom@^19.2.8",
        "npm:react@^19.2.8",
        "npm:svix@^1.99.1",
        "npm:swr@^2.5.1",
        "npm:tailwind-merge@^3.6.0",
        "npm:tailwindcss@^3.4.17",
        "npm:typescript@^5.8.2",
        "npm:zod@^3.24.2"
      ]
    }
  }
}
```

---

## 3. Complete Repository Directory Tree

```
/Users/rahulg/adsHunting 2/
├── AGENTS.md                                        # Agent workspace instruction file with Next.js 16 breaking change warning
├── CLAUDE.md                                       # Assistant guidance file
├── COMPETITORS_FIX_PLAN.md                         # Architecture remediation document for competitor sync & tracking
├── MEDIA_RENDERING_FIX.md                          # Implementation log for video/image/carousel parsing fixes
├── README.md                                       # Project overview, legacy setup guide, and environment overview
├── app/                                            # Next.js App Router root
│   ├── (activation)/                               # User onboarding & billing activation route group
│   │   ├── billing/page.tsx                        # Cashfree Early Access payment checkout gate page
│   │   ├── layout.tsx                              # Activation boundary layout
│   │   └── welcome/                                # Post-checkout onboarding survey flow
│   │       ├── actions.ts                          # Server Action: completeOnboarding() updating profiles.onboarding_completed
│   │       ├── client.tsx                          # Interactive onboarding stepper client component
│   │       └── page.tsx                            # Welcome page server shell
│   ├── (marketing)/                                # Public marketing pages
│   │   ├── about/page.tsx                          # Company mission and team overview page
│   │   ├── contact/page.tsx                        # Contact form and support routing
│   │   ├── layout.tsx                              # Marketing navbar and footer layout
│   │   ├── page.tsx                                # Main adshunting.com marketing homepage
│   │   ├── pricing/page.tsx                        # Pricing tier comparison page (Scout, Hunter, Agency)
│   │   ├── privacy/page.tsx                        # Privacy policy and data handling documentation
│   │   ├── product/[slug]/page.tsx                 # Dynamic SEO product landing pages (discover-ads, swipe-files, etc.)
│   │   ├── resources/                              # Creative strategy guides and documentation
│   │   │   ├── competitor-ad-research/page.tsx     # Competitor research deep-dive guide
│   │   │   ├── creative-research/page.tsx          # Creative analysis and angle guide
│   │   │   ├── help/page.tsx                       # Product FAQ and help center
│   │   │   ├── how-it-works/page.tsx               # Product workflow guide
│   │   │   └── page.tsx                            # Resource directory index
│   │   └── terms/page.tsx                          # Terms of Service agreement
│   ├── (workspace)/                                # Authenticated application workspace
│   │   ├── (paid)/                                 # Gated routes requiring active subscription or Early Access
│   │   │   ├── analytics/page.tsx                  # Aggregate ad landscape analytics dashboard
│   │   │   ├── brands/                             # Brand intelligence directory
│   │   │   │   ├── [id]/page.tsx                   # Individual brand ad archive & profile view
│   │   │   │   └── page.tsx                        # Brand search and discovery index
│   │   │   ├── competitors/                        # Competitor tracking view
│   │   │   │   ├── [id]/page.tsx                   # Detailed competitor creative breakdown view
│   │   │   │   └── page.tsx                        # Competitor list, sync state & management page
│   │   │   ├── dashboard/page.tsx                  # Central user home dashboard
│   │   │   ├── discover/page.tsx                   # Live Meta ad search, filtering, and discovery engine
│   │   │   ├── layout.tsx                          # Entitlement & credit context enforcement wrapper
│   │   │   ├── saved/page.tsx                      # Legacy saved ads view (redirects/integrates with Swipe Files)
│   │   │   ├── shared-ads/page.tsx                 # Management interface for user's generated shared ad links
│   │   │   └── swipe-files/                        # Swipe File folder manager
│   │   │       ├── [id]/page.tsx                   # Swipe File detail view displaying organized creatives
│   │   │       └── page.tsx                        # Swipe File collection overview
│   │   ├── faq/page.tsx                            # In-app FAQ & troubleshooting guide
│   │   ├── layout.tsx                              # AppShell and SessionBoundary layout wrapper
│   │   ├── loading.tsx                             # Workspace loading spinner skeleton
│   │   └── settings/                               # Workspace configuration
│   │       ├── alerts/page.tsx                     # Competitor email/notification preferences
│   │       ├── api/page.tsx                        # API status & integration connection testing console
│   │       ├── billing/                            # Billing management
│   │       │   ├── actions.ts                      # Server Action: cancelSubscription()
│   │       │   └── page.tsx                        # Billing history, current plan card, and cancellation view
│   │       ├── layout.tsx                          # Settings navigation tab layout
│   │       ├── mcp/page.tsx                        # Model Context Protocol server configuration settings
│   │       ├── page.tsx                            # Account profile settings (name, email, avatar)
│   │       └── team/                               # Team seat management
│   │           ├── actions.ts                      # Server Action: inviteTeamMember()
│   │           └── page.tsx                        # Team members table and seat allocation view
│   ├── api/                                        # Next.js Server Route Handlers
│   │   ├── ads/
│   │   │   ├── [id]/route.ts                       # GET: Fetch single ad by internal UUID, canonical ID, or external ID
│   │   │   └── search/route.ts                     # POST: Re-exports /api/search POST handler
│   │   ├── brands/search/route.ts                  # POST: Live brand candidate discovery and database search
│   │   ├── competitors/route.ts                    # GET, POST, PATCH, DELETE: Competitor tracking CRUD & sync triggers
│   │   ├── feedback/route.ts                       # POST: User feedback & attachment upload to Supabase & Deftform
│   │   ├── integrations/status/route.ts            # GET, POST: Live probe & health check for Meta, SearchAPI, Foreplay, Supabase
│   │   ├── saved-filters/                          # Filter preset persistence
│   │   │   ├── [id]/route.ts                       # PATCH, DELETE: Manage specific saved search filter preset
│   │   │   └── route.ts                            # GET, POST: List and create saved search filter presets
│   │   ├── search/
│   │   │   ├── google/route.ts                     # POST: Google Programmable Search API brand enrichment
│   │   │   ├── route.ts                            # POST: Primary ad search, provider orchestration, scoring & persistence
│   │   │   └── suggestions/route.ts                # GET: Instant search autocomplete for brands, keywords & categories
│   │   ├── sentry-example-api/route.ts             # GET: Sentry test error generation route
│   │   ├── shared-ads/                             # Ad sharing infrastructure
│   │   │   ├── [id]/
│   │   │   │   ├── enable/route.ts                 # POST: Reactivate a revoked shared ad link
│   │   │   │   ├── revoke/route.ts                 # POST: Immediately revoke/disable a shared ad link
│   │   │   │   ├── route.ts                        # GET, PATCH, DELETE: Manage individual shared ad link
│   │   │   │   └── visibility/route.ts             # POST: Toggle public vs private visibility of a shared link
│   │   │   └── route.ts                            # GET, POST: List owned share links and create new share links
│   │   ├── swipe-files/                            # Swipe File collection CRUD
│   │   │   ├── [id]/route.ts                       # GET, PATCH, DELETE: Specific swipe file collection management
│   │   │   ├── ads/route.ts                        # GET: Query ads belonging to a specific swipe file
│   │   │   ├── items/route.ts                      # POST: Toggle/save ad into a swipe file (resolving external/canonical IDs)
│   │   │   ├── memberships/route.ts                # GET: Check which swipe files contain a given ad ID
│   │   │   └── route.ts                            # GET, POST: List user swipe files and create new swipe files
│   │   ├── tags/route.ts                           # GET, POST, DELETE: Ad tagging system for saved ads
│   │   └── webhooks/clerk/route.ts                 # POST: Clerk Svix webhook handling user creation, update, deletion & sessions
│   ├── auth/callback/route.ts                      # GET: Auth redirect handler forwarding to /dashboard
│   ├── error.tsx                                   # Global React error boundary component
│   ├── global-error.tsx                             # Root-level error boundary with Sentry capture
│   ├── globals.css                                 # Tailwind CSS base styles and design tokens
│   ├── icon.png                                    # Application favicon asset
│   ├── layout.tsx                                  # Root HTML layout with ClerkProvider and font configuration
│   ├── login/page.tsx                              # Redirect helper to /sign-in
│   ├── manifest.ts                                 # Web app manifest configuration
│   ├── not-found.tsx                               # 404 page component
│   ├── opengraph-image.tsx                         # Dynamic OG preview image generator
│   ├── robots.ts                                   # Dynamic robots.txt generator
│   ├── sentry-example-page/page.tsx                # Sentry client error testing page
│   ├── share/[token]/                              # Public/authenticated shared ad view
│   │   ├── page.tsx                                # Shared ad viewer server page validating token & permissions
│   │   └── shared-ads-viewer.tsx                   # Interactive client grid for viewing shared creatives
│   ├── sign-in/[[...sign-in]]/page.tsx             # Clerk turnkey Sign-In component page
│   ├── sign-up/[[...sign-up]]/page.tsx             # Clerk turnkey Sign-Up component page
│   ├── signup/page.tsx                             # Redirect helper to /sign-up
│   └── sitemap.ts                                  # Dynamic XML sitemap generator
├── components/                                     # Reusable React components
│   ├── ad-card.tsx                                 # Creative ad card with lazy video preview, badges & action buttons
│   ├── ad-detail.tsx                               # Slide-over ad drawer displaying copy, assets, signals & breakdown
│   ├── ad-media.tsx                                # Resilient image/video/carousel media renderer
│   ├── analytics-view.tsx                          # Aggregate charts for format distribution and launch trends
│   ├── app-dialog.tsx                              # Accessible dialog modal primitive
│   ├── app-shell.tsx                               # Authenticated navigation bar, search bar, and sidebar shell
│   ├── auth-shell.tsx                              # Authentication container layout for login/signup
│   ├── auth/
│   │   ├── animated-product-canvas.tsx             # Animated background showcase for auth pages
│   │   └── owner-welcome-modal.tsx                 # First-time platform owner welcome dialog
│   ├── billing/
│   │   ├── BillingHistory.tsx                      # Table listing past invoices and payment records
│   │   ├── BillingSkeleton.tsx                     # Loading skeleton for billing status
│   │   ├── BillingStatusCard.tsx                   # Card showing current plan, status, renewal date & cancel button
│   │   ├── CreditsContext.tsx                      # React Context providing live workspace credit balance
│   │   ├── EarlyAccessCheckout.tsx                 # Cashfree One-Click Checkout modal integration component
│   │   ├── ExplorePlans.tsx                        # Tier comparison cards for upgrading subscription
│   │   └── PaymentMethodCard.tsx                   # Payment gateway provider details card
│   ├── brand-card.tsx                              # Card previewing a brand with active ad count and top creatives
│   ├── brand-intelligence-profile.tsx              # Deep-dive analytics on an advertiser's historical campaigns
│   ├── brand-mark.tsx                              # Brand logo component
│   ├── brand-profile.tsx                           # Brand header component with verified links and category tags
│   ├── brand-web-intelligence.tsx                  # Web presence data populated via Google Search API
│   ├── brand/AdsHuntingLogo.tsx                    # Official AdsHunting SVG vector logo
│   ├── bucket-icon.tsx                             # Legacy Bucket icon SVG component
│   ├── carousel-preview.tsx                        # Multi-card interactive carousel ad player
│   ├── competitor-dashboard.tsx                    # Competitor monitoring view with tracking stats and quick filters
│   ├── competitor-manager.tsx                      # Add/remove competitors modal and table
│   ├── contact/ContactForm.tsx                     # Client form for user inquiries
│   ├── copy-link-button.tsx                        # Clipboard copy button with toast notification
│   ├── create-swipe-file-modal.tsx                 # Modal to create a new named Swipe File folder
│   ├── dashboard-view.tsx                          # Home dashboard layout with recent ads, top runners, and quick metrics
│   ├── discover-experience.tsx                     # Primary search interface with active filter chips and sort bar
│   ├── faq/FAQItem.tsx                             # Collapsible accordion item for FAQs
│   ├── filters/
│   │   ├── advanced-filters.tsx                    # Multi-facet filter panel (status, format, market, language, runtime)
│   │   ├── saved-filters.tsx                       # Dropdown to save and load named filter presets
│   │   └── ui-primitives.tsx                       # Filter pills, checkbox groups, and range sliders
│   ├── header-user-menu.tsx                        # Top navigation user dropdown with Clerk UserButton and credit badge
│   ├── landing/                                    # Public landing page sections
│   │   ├── about/AboutContent.tsx                  # About page body component
│   │   ├── animations/CreativeIntelligenceAnimation.tsx # Vector animation depicting ad scoring logic
│   │   ├── layout/                                 # Landing page shell components
│   │   │   ├── Footer.tsx                          # Public footer with sitemap links
│   │   │   ├── LandingContainer.tsx                # Max-width layout wrapper
│   │   │   └── Navbar.tsx                          # Public marketing navigation header
│   │   ├── legal/LegalPage.tsx                     # Structured legal markdown viewer
│   │   ├── product/                                # Interactive product feature demos
│   │   │   ├── DiscoverDemo.tsx                    # Mock discovery interactive preview
│   │   │   ├── ProductFeatureSection.tsx           # Generic feature highlight component
│   │   │   ├── ResearchDemo.tsx                    # Mock creative analysis interactive preview
│   │   │   ├── ReviewDemo.tsx                      # Mock ad review interactive preview
│   │   │   └── SaveDemo.tsx                        # Mock swipe file interactive preview
│   │   ├── sections/                               # Marketing page sections
│   │   │   ├── AudienceSection.tsx                 # "Who AdsHunting is for" section
│   │   │   ├── CapabilityGridSection.tsx           # Grid showcasing platform capabilities
│   │   │   ├── CoreValueSection.tsx                # Value proposition cards
│   │   │   ├── DiscoverAdsSection.tsx              # Ad discovery highlight section
│   │   │   ├── FAQSection.tsx                      # Public landing page FAQ
│   │   │   ├── FinalCTASection.tsx                 # Bottom call-to-action banner
│   │   │   ├── HeroOpticalBackground.tsx           # Visual background effects for hero
│   │   │   ├── HeroProductPreview.tsx              # Interactive mock of the AdsHunting workspace
│   │   │   ├── HeroSection.tsx                     # Main hero banner with headline and CTA
│   │   │   ├── IntelligenceSharingSection.tsx      # Ad sharing and collaboration section
│   │   │   ├── ProblemSection.tsx                  # "The problem with ad libraries" breakdown
│   │   │   ├── ReviewResearchSection.tsx           # Research workflow section
│   │   │   ├── SaveShareSection.tsx                # Swipe file and sharing section
│   │   │   ├── ShareDemo.tsx                       # Mock ad sharing demonstration
│   │   │   ├── TrustProofSection.tsx               # Social proof and statistics
│   │   │   └── WorkflowSection.tsx                 # 4-step research workflow breakdown
│   │   └── ui/                                     # Marketing UI primitives
│   │       ├── CTAButton.tsx                       # Glowing call-to-action button
│   │       ├── SectionHeading.tsx                  # Standardized section title component
│   │       └── Surface.tsx                         # Glassmorphism background surface component
│   ├── modal-shell.tsx                             # Base modal backdrop and animated panel
│   ├── profile-popover-test.tsx                    # Development test component for user popovers
│   ├── resources/                                  # Components for public educational guides
│   │   ├── HelpClient.tsx                          # Interactive help search client
│   │   ├── ResourceBreadcrumbs.tsx                 # Breadcrumb navigation for resource pages
│   │   ├── ResourceCTA.tsx                         # Embedded call-to-action within guides
│   │   ├── ResourceContainer.tsx                   # Article layout container
│   │   ├── ResourceGuideNav.tsx                    # Table-of-contents navigation
│   │   ├── ResourceHero.tsx                        # Hero banner for educational guides
│   │   └── ResourceRelatedLinks.tsx                # Related guide recommendations
│   ├── save-modal.tsx                              # Modal to save an ad into one or more Swipe Files
│   ├── saved-ads-view.tsx                          # Grid view of ads saved in the legacy default folder
│   ├── search/search-autocomplete.tsx              # Omnibar search autocomplete component
│   ├── session-boundary.tsx                        # Single-session client listener signing out when session is replaced
│   ├── settings-account.tsx                        # User profile edit form
│   ├── settings-billing.tsx                        # Settings billing tab container
│   ├── settings-general.tsx                        # General workspace preferences
│   ├── settings-integrations.tsx                   # Integration health test trigger panel
│   ├── settings-nav.tsx                            # Settings navigation sub-menu
│   ├── settings-team.tsx                           # Team member invitation and management component
│   ├── share-modal.tsx                             # Modal to create and customize a shared ad link
│   ├── shared-ads-manager.tsx                      # Management table for active and expired share links
│   ├── shared-creative-view.tsx                    # Full-page shared creative detail layout
│   ├── sidebar-swipe-files.tsx                     # Collapsible sidebar list of user's Swipe Files
│   ├── sidebar.tsx                                 # Main application navigation sidebar
│   ├── support/                                    # In-app support and feedback system
│   │   ├── BookingSupport.tsx                      # Calendar booking widget integration
│   │   ├── EmailSupport.tsx                        # Direct email support card
│   │   ├── FeedbackSupport.tsx                     # Bug/feedback form with file upload
│   │   ├── SupportModal.tsx                        # Unified customer support modal dialog
│   │   └── support-context.tsx                     # Context controlling support modal visibility
│   ├── swipe-file-picker.tsx                       # Dropdown selector for Swipe Files
│   ├── swipe-files-manager.tsx                     # Swipe File management grid and creation trigger
│   ├── ui.tsx                                      # Shared UI primitives: Button, Card, Badge, Input, Select, EmptyState
│   └── video-preview.tsx                           # HTML5 video element with lazy loading, mute, and error fallback
├── data/                                           # Static configuration and demo data
│   ├── faq.ts                                      # Central repository of FAQ questions and answers
│   └── landing/                                    # Marketing copy data
│       ├── config.ts                               # Pricing tiers, navigation links, and feature definitions
│       ├── demoAds.ts                              # Static ad data for marketing product previews
│       ├── faq.ts                                  # Landing page specific FAQ list
│       ├── productSeo.ts                           # Dynamic SEO content for product landing pages
│       └── workflowAds.ts                          # Sample ads for workflow illustration
├── deno.lock                                       # Deno dependency lockfile for Supabase Edge Functions
├── eslint.config.mjs                               # ESLint 9 flat configuration
├── get_green.py                                    # Development script extracting primary color palette
├── hooks/                                          # Custom React hooks
│   └── use-swipe-files.ts                          # SWR hook for loading and mutating user's Swipe Files
├── instrumentation-client.ts                       # Sentry client-side initialization and session replay config
├── instrumentation.ts                              # Next.js instrumentation registering Sentry for Node and Edge runtimes
├── lib/                                            # Core application business logic and backend libraries
│   ├── __tests__/intelligence.test.ts              # Unit tests for Signal Intelligence scoring algorithms
│   ├── ads-persistence.ts                          # Upsert logic for normalized ads into Supabase with identity protection
│   ├── advertiser-identity.ts                      # Identity normalization, canonical naming, and brand matching
│   ├── analytics.ts                                # Aggregate ad database analytics calculations
│   ├── api-client.ts                               # Authenticated frontend API client wrapper
│   ├── archive-batch.ts                            # Media archival batch processing helper
│   ├── auth-session.ts                             # Single active session validation via Clerk API and Supabase RPC
│   ├── auth.ts                                     # Server authentication helper wrapping Clerk auth() and Supabase admin
│   ├── billing/                                    # Workspace entitlement, plans, and credit ledger
│   │   ├── __tests__/entitlements.test.ts          # Unit tests for entitlement evaluation
│   │   ├── billing-config.ts                       # Plan definitions (Scout, Hunter, Agency, Early Access)
│   │   ├── entitlement.ts                          # Workspace access evaluation (active sub, early access, platform owner)
│   │   ├── limits.ts                               # Plan limit resolution (seats, swipe files, shared ads)
│   │   ├── reviewer.ts                             # Payment gateway reviewer bypass logic
│   │   ├── subscription-state.ts                   # Billing status and entitlement type definitions
│   │   └── usage.ts                                # Credit balance retrieval and report_search_and_delivery_usage caller
│   ├── brand-data.ts                               # Brand summary builder and competitor ad sync orchestration
│   ├── brand.ts                                    # Central application branding constants (AdsHunting)
│   ├── catalog.ts                                  # DatabaseAdRow <-> NormalizedAd transformation and schema mapping
│   ├── clerk-theme.ts                              # Dark-mode Clerk styling configuration
│   ├── dashboard.ts                                # Aggregated data queries for the workspace home dashboard
│   ├── env.ts                                      # Client-safe Supabase environment variable validation
│   ├── env/server.ts                               # Zod schema validation for all server environment variables
│   ├── filter-utils.ts                             # Filter normalization, sanitization, and active count calculation
│   ├── fingerprint.ts                              # Deterministic SHA-256 ad fingerprinting and canonical ID generator
│   ├── format/date.ts                              # Human-readable date and duration formatters
│   ├── hashtags.ts                                 # Hashtag extraction and normalization utility
│   ├── hooks/                                      # Specialized internal hooks
│   │   ├── use-ad-impression-tracker.ts            # Viewport observer tracking ad card impressions
│   │   └── use-url-filters.ts                      # Bi-directional URL search query string synchronization hook
│   ├── intelligence-enricher.ts                    # Ad metadata enricher adding intelligence categories and scores
│   ├── intelligence.ts                             # Signal Intelligence Engine v1.0 (Winner Score calculation)
│   ├── media-access.ts                             # Signed URL generator for private Supabase Storage creative assets
│   ├── media-archiver.ts                           # Server-side HTTP downloader and Supabase Storage uploader
│   ├── media.ts                                    # Media URL validator, CDN expiry inspector, and card resolver
│   ├── meta-config.ts                              # Meta Graph API version and endpoint configuration
│   ├── navigation.ts                               # Sidebar navigation items and icon mapping
│   ├── platform-owner.ts                           # Hardcoded platform owner authorization (creatornavigator@gmail.com)
│   ├── preview.ts                                  # Preview mode detection (IS_PREVIEW)
│   ├── providers/                                  # Next.js server-side ad provider implementations
│   │   ├── errors.ts                               # Standardized ProviderError class and HTTP status mapper
│   │   ├── foreplay.ts                             # Foreplay API provider adapter
│   │   ├── google-search.ts                        # Google Programmable Search API provider adapter
│   │   ├── index.ts                                # Provider factory and runtime health tracking registry
│   │   ├── meta.ts                                 # Official Meta Graph API ads_archive provider adapter
│   │   ├── searchapi.ts                            # Multi-key SearchAPI Meta scraper provider adapter
│   │   └── spyglass.ts                             # Spyglass API provider adapter
│   ├── rate-limit.ts                               # In-memory sliding window rate limiter
│   ├── refinement.ts                               # Partial ad refiner and default field fallback injector
│   ├── seo.ts                                      # Central SEO metadata, JSON-LD schema, and route definitions
│   ├── supabase/                                   # Supabase client instantiation
│   │   ├── admin.ts                                # Privileged Supabase client using SUPABASE_SERVICE_ROLE_KEY
│   │   ├── clerk-client.ts                         # Browser Supabase client using Clerk session token
│   │   ├── clerk-server.ts                         # Server Supabase client with Clerk JWT authorization header
│   │   ├── client.ts                               # Standard browser Supabase client
│   │   └── server.ts                               # Standard server-side Supabase client using Next.js cookies
│   ├── support/config.ts                           # Support email and booking URL configuration
│   ├── swipe-files.ts                              # Database operations for Swipe Files and Swipe File Items
│   ├── taxonomy.ts                                 # Fixed categories: 46 Niches, 15 Content Styles, Languages, Markets
│   ├── types.ts                                    # Canonical TypeScript interfaces for Ads, Filters, Brands, Providers
│   └── utils.ts                                    # String sanitization, URL validation, and duration calculation utilities
├── logs.txt                                        # Development runtime log dump
├── next-env.d.ts                                   # Next.js TypeScript ambient type declarations
├── next.config.mjs                                 # Next.js configuration with Sentry wrapper, redirects & remote images
├── package-lock.json                               # Deterministic npm package lockfile
├── package.json                                    # Project manifests, npm scripts, and dependencies
├── patch_apis.py                                   # Utility script patching API endpoints
├── postcss.config.mjs                              # PostCSS configuration for Tailwind CSS
├── proxy.ts                                        # Next.js 16 Proxy convention (replaces middleware.ts) with Clerk & canonical redirects
├── public/                                         # Public static assets
│   ├── icon.png                                    # Favicon icon
│   ├── logo.png                                    # AdsHunting primary logo
│   └── ...                                         # Static media assets
├── rebrand.sh                                      # Bash script executing rebranding from Bucket to AdsHunting
├── replace_blue_with_green.py                      # Theme color migration utility
├── scripts/                                        # Administrative and migration scripts
│   ├── backfill-winner-scores.ts                   # CLI script backfilling Winner Scores across all catalog ads
│   ├── deduplicate-ads.ts                          # CLI script identifying and merging duplicate ads by fingerprint
│   ├── fix-brands.ts                               # CLI script repairing advertiser names and avatar links
│   ├── measure-swipe.ts                            # Benchmark script measuring Swipe File query latency
│   ├── test-search-quality.js                      # Search query accuracy verification script
│   └── verify-advertiser-live.cjs                  # Live verification script testing advertiser resolution
├── sentry.edge.config.ts                           # Sentry configuration for Edge runtimes
├── sentry.server.config.ts                         # Sentry configuration for Node.js server runtimes
├── supabase/                                       # Supabase infrastructure configuration
│   ├── config.toml                                 # Supabase local/CLI project configuration
│   ├── functions/                                  # Deno Edge Functions
│   │   ├── _shared/                                # Shared Edge Function modules
│   │   │   ├── ads/                                # Core ad intelligence and provider engine
│   │   │   │   ├── advertiser-identity.ts          # Advertiser matching and brand identity resolution
│   │   │   │   ├── enrichment/                     # Creative enrichment modules
│   │   │   │   │   ├── brand-resolver.ts           # Domain and logo resolution for advertisers
│   │   │   │   │   └── landing-page.ts             # Landing page metadata extraction
│   │   │   │   ├── fingerprint.ts                  # Deno-compatible SHA-256 creative fingerprinting
│   │   │   │   ├── intelligence.ts                 # Deno-compatible Signal Intelligence Engine
│   │   │   │   ├── orchestrator.ts                 # AdsProviderOrchestrator with circuit breakers & failover
│   │   │   │   ├── providers/                      # Provider implementations for Deno
│   │   │   │   │   ├── errors.ts                   # Standard ProviderError definitions
│   │   │   │   │   ├── foreplay.ts                 # Foreplay API provider adapter
│   │   │   │   │   ├── meta.ts                     # Meta Graph API provider adapter
│   │   │   │   │   ├── metaapiio.ts                # MetaAPI.io stubbed provider adapter (throws 501)
│   │   │   │   │   ├── searchapi.ts                # SearchAPI scraper provider adapter
│   │   │   │   │   └── spyglass.ts                 # Spyglass API provider adapter
│   │   │   │   ├── refinement/                     # Post-fetch normalization and scoring
│   │   │   │   │   ├── advertiser.ts               # Advertiser cleanup
│   │   │   │   │   ├── deduper.ts                  # Ad array deduplication
│   │   │   │   │   ├── index.ts                    # Pipeline export
│   │   │   │   │   ├── media.ts                    # Media URL resolution
│   │   │   │   │   ├── relevance.ts                # Keyword match scoring
│   │   │   │   │   ├── sanitizer.ts                # Copy sanitization
│   │   │   │   │   └── scorer.ts                   # Winner score wrapper
│   │   │   │   ├── types.ts                        # Ad and provider TypeScript types for Edge
│   │   │   │   └── utils.ts                        # Utility helpers for Deno
│   │   │   ├── cashfree.ts                         # Cashfree API v2023-08-01 client and HMAC-SHA256 verification
│   │   │   ├── clerk.ts                            # Remote JWKS token verification for Clerk in Deno
│   │   │   ├── cors.ts                             # CORS headers and OPTIONS preflight handler
│   │   │   └── early-access.ts                     # Early Access constants (₹588.82, 3,000 credits)
│   │   ├── ads-search/index.ts                     # Edge Function: Authenticated ad search provider proxy
│   │   ├── billing-cancel-subscription/            # Empty legacy directory (Razorpay cleanup)
│   │   ├── billing-create-early-access/index.ts    # Edge Function: Creates Cashfree OCC order for Early Access
│   │   ├── billing-create-subscription/            # Empty legacy directory (Razorpay cleanup)
│   │   ├── billing-reconcile-subscription/         # Empty legacy directory (Razorpay cleanup)
│   │   ├── billing-verify-early-access/index.ts    # Edge Function: Authoritative Cashfree payment verification & provisioning
│   │   ├── cashfree-webhook/index.ts               # Edge Function: Ingests Cashfree payment webhooks idempotently
│   │   ├── deno.d.ts                               # TypeScript ambient declarations for Deno runtime
│   │   ├── diagnose-billing/                       # Empty legacy directory (Razorpay cleanup)
│   │   ├── razorpay-webhook/                       # Empty legacy directory (Razorpay cleanup)
│   │   └── test-cashfree/                          # Cashfree integration test edge function
│   │       ├── .npmrc                              # NPM package resolution config
│   │       ├── deno.json                           # Deno import map
│   │       └── index.ts                            # Test runner endpoint
│   ├── migrations/                                 # 27 PostgreSQL migration files (see Section 4)
│   └── templates/                                  # Supabase Auth email templates
│       ├── confirmation.html                       # Signup OTP email template
│       └── magic-link.html                         # Magic link OTP email template
├── tailwind.config.ts                              # Tailwind CSS configuration with custom typography & colors
├── test-*.js / test-*.ts                           # Root diagnostic and integration test scripts
├── tests/                                          # Node test runner suite
│   ├── advertiser-identity.test.ts                 # Tests for brand name normalization and identity preservation
│   ├── contract.test.ts                            # Contract tests for refineAd(), deduplication, and provider failover
│   ├── early-access.test.ts                        # Integration assertions for Cashfree pricing, OCC, and webhook rules
│   └── register-typescript.cjs                     # CommonJS TypeScript hook for Node test runner
├── tsconfig.json                                   # TypeScript compiler configuration (ES2022, bundler module resolution)
└── tsconfig.tsbuildinfo                            # Incremental TypeScript compilation cache
```

---

## 4. Database Schema, Models & Indexes

The PostgreSQL database is managed via 27 ordered migrations in `supabase/migrations/`. 

### 4.1 Complete Database Tables & Schema

#### 1. `public.ads`
Central catalog storing ingested and normalized advertising creatives.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `external_ad_id` (`text`, NOT NULL) — ID assigned by source provider.
- `canonical_ad_id` (`text`, UNIQUE) — Deterministic hash `canon_...` identifying identical creatives across accounts.
- `creative_fingerprint` (`text`) — SHA-256 hash of advertiser, media, headline, and copy.
- `creative_group_id` (`text`) — SHA-256 hash grouping ads with identical visuals across variations.
- `observation_count` (`integer`, NOT NULL, DEFAULT `1`) — Times this ad creative has been detected.
- `provider_ad_ids` (`text[]`, NOT NULL, DEFAULT `'{}'`) — Array of external IDs associated with this canonical ad.
- `advertiser_id` (`text`, NOT NULL) — Platform advertiser ID (e.g., Meta Page ID).
- `advertiser_name` (`text`, NOT NULL) — Advertiser brand name.
- `advertiser_avatar_url` (`text`) — Profile/avatar image URL.
- `advertiser_profile_url` (`text`) — Social profile or page URL.
- `body` (`text`) — Primary ad copy.
- `caption` (`text`) — Creative caption text.
- `headline` (`text`) — Creative headline/title.
- `description` (`text`) — Ad link description.
- `hashtags` (`text[]`, NOT NULL, DEFAULT `'{}'`) — Extracted hashtags.
- `cta` (`text`) — Normalized call to action (e.g., "Shop now", "Learn more").
- `landing_page_url` (`text`) — Advertiser destination URL.
- `source_media_url` (`text`) — Original upstream CDN media URL.
- `thumbnail_url` (`text`) — Video poster or image thumbnail URL.
- `carousel_assets` (`text[]`, NOT NULL, DEFAULT `'{}'`) — Array of image/video URLs for carousel ads.
- `stored_media_path` (`text`) — Path in Supabase Storage `ad-creatives` bucket if archived.
- `archive_status` (`text`, NOT NULL, DEFAULT `'not_requested'`, CHECK: `not_requested`, `archived`, `failed`, `unavailable`)
- `media_type` (`text`, NOT NULL, DEFAULT `'unknown'`, CHECK: `image`, `video`, `carousel`, `unknown`)
- `status` (`text`, NOT NULL, CHECK: `active`, `inactive`, `unknown`)
- `start_date` (`timestamptz`) — Campaign launch timestamp.
- `stop_date` (`timestamptz`) — Campaign termination timestamp.
- `first_seen_at` (`timestamptz`, NOT NULL, DEFAULT `now()`)
- `last_seen_at` (`timestamptz`, NOT NULL, DEFAULT `now()`)
- `missing_checks` (`integer`, NOT NULL, DEFAULT `0`) — Consecutive checks where ad was missing (inactivated at 3).
- `running_days` (`integer`) — Calculated days active.
- `country` (`text`) — Target market country code.
- `platforms` (`text[]`, NOT NULL, DEFAULT `'{}'`) — Array of platforms: `facebook`, `instagram`, `messenger`, `audience_network`, `threads`.
- `demographics` (`jsonb`) — Age, gender, and regional distribution data.
- `snapshot_url` (`text`) — Meta Ad Library permalink.
- `source` (`text`, NOT NULL, DEFAULT `'searchapi'`) — Provider origin.
- `variant_key` (`text`)
- `raw_data` (`jsonb`, NOT NULL, DEFAULT `'{}'`) — Full provider payload for forensic debugging.
- `refined_data` (`jsonb`, DEFAULT `'{}'`) — Nested canonical `RefinedAd` representation.
- `quality_score` (`integer`, DEFAULT `0`)
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`)
- `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`)
- **Indexes**:
  - `ads_advertiser_idx` on `(advertiser_id)`
  - `ads_status_start_idx` on `(status, start_date DESC)`
  - `ads_last_seen_idx` on `(last_seen_at DESC)`
  - `ads_media_type_idx` on `(media_type)`
  - `ads_created_at_idx` on `(created_at DESC)`
  - `ads_canonical_idx` on `(canonical_ad_id)`
  - `ads_group_idx` on `(creative_group_id)`
  - `ads_platforms_gin_idx` USING gin `(platforms)`
  - `ads_provider_ids_idx` USING gin `(provider_ad_ids)`
  - `ads_raw_data_gin_idx` USING gin `(raw_data jsonb_path_ops)`
  - `idx_ads_quality_score` on `(quality_score DESC)`
  - `ads_search_idx` USING gin `(to_tsvector('simple', coalesce(advertiser_name,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(body,'')))`
  - `ads_discover_creative_idx` on `(status, media_type, last_seen_at DESC)` WHERE `source_media_url IS NOT NULL`

#### 2. `public.profiles`
Synchronized Clerk user identities.
- `id` (`text`, PRIMARY KEY) — Clerk User ID (`user_...`).
- `clerk_user_id` (`text`, UNIQUE, NOT NULL).
- `email` (`text`).
- `full_name` (`text`).
- `avatar_url` (`text`).
- `onboarding_completed` (`boolean`, DEFAULT `false`).
- `is_platform_owner` (`boolean`, DEFAULT `false`).
- `role` (`text`, DEFAULT `'MEMBER'`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `last_login_at` (`timestamptz`).

#### 3. `public.swipe_files`
Unified creative swipe file collections (replaces legacy `collections` table).
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `user_id` (`text`, NOT NULL) — References `profiles(id)`.
- `name` (`text`, NOT NULL, CHECK length between 1 and 80).
- `description` (`text`, CHECK length <= 500).
- `is_system` (`boolean`, NOT NULL, DEFAULT `false`).
- `system_key` (`text`) — e.g., `'saved_ads'` for the default user folder.
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**: `UNIQUE(user_id, name)`.

#### 4. `public.swipe_file_items`
Many-to-many relationship mapping ads to Swipe Files.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `swipe_file_id` (`uuid`, NOT NULL, REFERENCES `swipe_files(id)` ON DELETE CASCADE).
- `ad_id` (`uuid`, NOT NULL, REFERENCES `ads(id)` ON DELETE CASCADE).
- `notes` (`text`, CHECK length <= 5000).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**: `UNIQUE(swipe_file_id, ad_id)`.

#### 5. `public.competitors`
Advertisers tracked by users for automated intelligence monitoring.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `user_id` (`text`, NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE).
- `advertiser_id` (`text`, NOT NULL).
- `advertiser_name` (`text`, NOT NULL).
- `advertiser_avatar_url` (`text`).
- `status` (`text`, DEFAULT `'tracking'`, CHECK: `tracking`, `paused`, `error`).
- `sync_status` (`text`, DEFAULT `'idle'`, CHECK: `idle`, `syncing`, `success`, `error`).
- `sync_error` (`text`).
- `ads_count` (`integer`, DEFAULT `-1`).
- `first_sync_completed_at` (`timestamptz`).
- `last_synced_at` (`timestamptz`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**:
  - `UNIQUE(user_id, advertiser_id)`
  - `competitors_user_idx` on `(user_id, created_at DESC)`
  - `competitors_sync_status_idx` on `(user_id, sync_status)`
  - `competitors_first_sync_idx` on `(user_id, first_sync_completed_at DESC)`

#### 6. `public.shared_ad_links`
Generated links for sharing curated ads or Swipe Files externally.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `owner_user_id` (`text`, NOT NULL) — References `profiles(id)`.
- `name` (`text`, NOT NULL, CHECK length between 1 and 100).
- `message` (`text`, CHECK length <= 1000).
- `token_hash` (`text`, NOT NULL, UNIQUE) — e.g. `rlt_` prefixed token.
- `content_type` (`text`, NOT NULL, CHECK: `single`, `multiple`, `swipe_file`).
- `swipe_file_id` (`uuid`, REFERENCES `swipe_files(id)` ON DELETE SET NULL).
- `expires_at` (`timestamptz`).
- `revoked_at` (`timestamptz`).
- `visibility` (`text`, NOT NULL, DEFAULT `'private'`).
- `allow_save` (`boolean`, NOT NULL, DEFAULT `false`).
- `allow_download` (`boolean`, NOT NULL, DEFAULT `false`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `last_viewed_at` (`timestamptz`).
- **Indexes**:
  - `shared_ad_links_owner_idx` on `(owner_user_id, created_at DESC)`
  - `shared_ad_links_token_hash_idx` on `(token_hash)`

#### 7. `public.shared_ad_items`
Ads attached to a specific shared link.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `shared_link_id` (`uuid`, NOT NULL, REFERENCES `shared_ad_links(id)` ON DELETE CASCADE).
- `ad_id` (`uuid`, NOT NULL, REFERENCES `ads(id)` ON DELETE CASCADE).
- `position` (`integer`, NOT NULL, DEFAULT `0`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**: `UNIQUE(shared_link_id, ad_id)`, index on `(shared_link_id, position ASC)`.

#### 8. `public.shared_ad_access_events`
Audit trail of views and interactions on shared ad links.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `shared_link_id` (`uuid`, NOT NULL, REFERENCES `shared_ad_links(id)` ON DELETE CASCADE).
- `viewer_user_id` (`text`) — Viewer's Clerk ID if authenticated.
- `event_type` (`text`, NOT NULL, CHECK: `opened`, `viewed_ad`, `played_video`, `saved_ad`, `downloaded_ad`).
- `safe_metadata` (`jsonb`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Indexes**: `shared_ad_access_events_link_idx` on `(shared_link_id, created_at DESC)`.

#### 9. `public.billing_subscriptions`
Workspace subscription lifecycle records.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL, UNIQUE) — Mapped to Clerk `user_id`.
- `owner_user_id` (`text`, NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE).
- `provider` (`text`, NOT NULL, DEFAULT `'razorpay'`).
- `razorpay_subscription_id` (`text`, UNIQUE).
- `razorpay_customer_id` (`text`).
- `razorpay_plan_id` (`text`).
- `plan_key` (`text`, NOT NULL) — `scout`, `hunter`, `agency`.
- `amount_paise` (`bigint`, NOT NULL, DEFAULT `49900`).
- `currency` (`text`, NOT NULL, DEFAULT `'INR'`).
- `status` (`text`, NOT NULL, DEFAULT `'not_started'`).
- `provider_status` (`text`).
- `trial_started_at`, `trial_ends_at`, `subscription_started_at`, `current_period_start`, `current_period_end`, `next_charge_at` (`timestamptz`).
- `cancel_at_period_end` (`boolean`, NOT NULL, DEFAULT `false`).
- `cancelled_at` (`timestamptz`).
- `last_payment_id`, `last_payment_status` (`text`), `last_payment_at` (`timestamptz`).
- `created_at`, `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).

#### 10. `public.billing_payments`
Payment ledger for subscriptions and one-time Early Access purchases.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL).
- `subscription_id` (`uuid`, REFERENCES `billing_subscriptions(id)` ON DELETE CASCADE).
- `provider` (`text`, NOT NULL, DEFAULT `'razorpay'`) — `'razorpay'` or `'cashfree'`.
- `provider_order_id` (`text`) — Cashfree Order ID (e.g. `ea_...`).
- `provider_payment_id` (`text`) — Cashfree Payment ID (`cf_payment_id`).
- `razorpay_payment_id` (`text`, UNIQUE, nullable).
- `razorpay_invoice_id` (`text`).
- `payment_type` (`text`, NOT NULL, DEFAULT `'subscription'`) — `'subscription'` or `'early_access'`.
- `base_amount_paise` (`bigint`) — e.g. `49900` (₹499.00).
- `gst_amount_paise` (`bigint`) — e.g. `8982` (₹89.82).
- `gst_rate` (`numeric(5,4)`) — `0.1800` (18% GST).
- `amount_paise` (`bigint`, NOT NULL) — e.g. `58882` (₹588.82 total).
- `credits_granted` (`bigint`, NOT NULL, DEFAULT `0`) — `3000` for Early Access.
- `currency` (`text`, NOT NULL, DEFAULT `'INR'`).
- `status` (`text`, NOT NULL) — `creating`, `active`, `attempted`, `pending`, `paid`, `failed`, `cancelled`, `user_dropped`, `void`.
- `billing_period_start`, `billing_period_end`, `paid_at`, `failed_at` (`timestamptz`).
- `created_at`, `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Indexes**:
  - `uq_billing_payments_provider_order` UNIQUE on `(provider, provider_order_id)` WHERE `provider_order_id IS NOT NULL`
  - `uq_billing_payments_provider_payment` UNIQUE on `(provider, provider_payment_id)` WHERE `provider_payment_id IS NOT NULL`
  - `uq_early_access_payment_per_workspace` UNIQUE on `(workspace_id)` WHERE `payment_type = 'early_access' AND status IN ('creating', 'active', 'attempted', 'pending', 'paid')`

#### 11. `public.billing_access_grants`
Explicit entitlement override records.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL).
- `grant_type` (`text`, NOT NULL) — `'early_access'` or `'legacy_grace'`.
- `starts_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `ends_at` (`timestamptz`) — Null for permanent lifetime access.
- `reason` (`text`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints**: `UNIQUE(workspace_id, grant_type)`.

#### 12. `public.workspace_credit_balances`
Ledger tracking credit allowances and usage per workspace cycle.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL).
- `subscription_id` (`uuid`, REFERENCES `billing_subscriptions(id)`).
- `source_payment_id` (`uuid`, REFERENCES `billing_payments(id)`).
- `cycle_start` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `cycle_end` (`timestamptz`, NOT NULL) — `'infinity'::timestamptz` for non-expiring Early Access credits.
- `credits_allocated` (`bigint`, NOT NULL, DEFAULT `0`) — `3000` for Early Access.
- `credits_used` (`bigint`, NOT NULL, DEFAULT `0`).
- `created_at`, `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Indexes**:
  - `uq_workspace_credit_source_payment` UNIQUE on `(source_payment_id)` WHERE `source_payment_id IS NOT NULL`
  - `idx_workspace_credit_balances_lookup` on `(workspace_id, cycle_end, cycle_start DESC)`

#### 13. `public.credit_usage_events`
Immutable ledger of credit expenditures.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL).
- `user_id` (`text`, NOT NULL).
- `billing_cycle_id` (`uuid`, NOT NULL, REFERENCES `workspace_credit_balances(id)`).
- `search_session_id` (`text`, NOT NULL).
- `idempotency_key` (`text`, NOT NULL).
- `ad_id` (`text`) — Null for base search queries; populated with ad ID for delivery charges.
- `event_type` (`text`, NOT NULL) — `'AD_SEARCH'`, `'BRAND_SEARCH'`, `'AD_DELIVERED'`.
- `credits` (`integer`, NOT NULL) — `15` for search; `10` per ad delivered.
- `metadata` (`jsonb`, DEFAULT `'{}'`).
- `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**: `uq_credit_usage_event` UNIQUE on `(workspace_id, search_session_id, idempotency_key, event_type)`.

#### 14. `public.user_active_sessions`
Single-active-session concurrency enforcement.
- `user_id` (`text`, PRIMARY KEY, REFERENCES `profiles(id)` ON DELETE CASCADE).
- `active_session_id` (`text`, NOT NULL) — Clerk session ID (`sess_...`).
- `session_created_at` (`timestamptz`, NOT NULL).
- `activated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).

#### 15. `public.user_saved_filters`
Named search filter presets.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `user_id` (`text`, NOT NULL, REFERENCES `profiles(id)` ON DELETE CASCADE).
- `name` (`text`, NOT NULL, CHECK length between 1 and 80).
- `description` (`text`, CHECK length <= 500).
- `filters` (`jsonb`, NOT NULL, DEFAULT `'{}'`).
- `is_default` (`boolean`, NOT NULL, DEFAULT `false`).
- `created_at`, `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Constraints & Indexes**: `UNIQUE(user_id, name)`.

#### 16. `public.support_feedback`
In-app user bug reports, feature requests, and feedback.
- `id` (`uuid`, PRIMARY KEY, `gen_random_uuid()`)
- `workspace_id` (`text`, NOT NULL).
- `user_id` (`text`, NOT NULL).
- `type` (`text`, NOT NULL).
- `message` (`text`, NOT NULL).
- `attachment_path` (`text`) — Path in `support-attachments` storage bucket.
- `page_url` (`text`).
- `request_id` (`text`).
- `status` (`text`, DEFAULT `'new'`, CHECK: `new`, `reviewing`, `resolved`, `closed`).
- `created_at`, `updated_at` (`timestamptz`, DEFAULT `now()`).

#### 17. `public.search_resolution_cache`
Cache mapping raw search terms to canonical brand identifiers.
- `query_text` (`text`, PRIMARY KEY).
- `provider_brand_id` (`text`, NOT NULL).
- `canonical_name` (`text`, NOT NULL).
- `logo_url` (`text`).
- `last_resolved_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).

#### 18. `public.tags` & `public.saved_ad_tags`
Tagging system for saved ads.
- `public.tags`: `id` (`uuid`, PK), `user_id` (`text`), `name` (`text`), `created_at`. UNIQUE `(user_id, name)`.
- `public.saved_ad_tags`: `saved_ad_id` (`uuid`), `tag_id` (`uuid`), `created_at`. PRIMARY KEY `(saved_ad_id, tag_id)`.

#### 19. Legacy Tables (Migrated/Consolidated)
- `public.saved_ads`, `public.collections`, `public.collection_ads`: Consolidated into `swipe_files` and `swipe_file_items` in migration `202608180002`.
- `public.search_history`: Search queries log.
- `public.billing_webhook_events`: Idempotent log of raw billing webhook deliveries.
- `public.billing_trial_usage`: Legacy trial usage tracking table.

---

### 4.2 Stored Procedures & Database Functions (RPCs)

1. **`finalize_early_access_purchase(p_workspace_id, p_provider, p_order_id, p_payment_id, p_paid_at)`**:
   - `SECURITY DEFINER`, runs as DB owner.
   - Locks the corresponding row in `billing_payments` with `FOR UPDATE`.
   - Validates that amounts match exact constants: `base_amount_paise = 49900`, `gst_amount_paise = 8982`, `amount_paise = 58882`, and `currency = 'INR'`.
   - Updates `billing_payments.status = 'paid'` and sets `credits_granted = 3000`.
   - Inserts `billing_access_grants` row with `grant_type = 'early_access'`.
   - Atomically provisions a row in `workspace_credit_balances` with `credits_allocated = 3000`, `credits_used = 0`, and `cycle_end = 'infinity'`.
2. **`report_search_and_delivery_usage(...)`**:
   - Atomic credit deduction procedure.
   - Locks active cycle in `workspace_credit_balances` with `FOR UPDATE`.
   - Idempotently charges base query cost (15 credits for `AD_SEARCH`) using `(workspace_id, search_session_id, idempotency_key, event_type)` constraint.
   - Loops through `p_delivery_ad_ids`, charging 10 credits per accepted ad (`AD_DELIVERED`) until the balance is exhausted.
   - Updates `workspace_credit_balances.credits_used`.
3. **`activate_session_if_newer(p_user_id, p_session_id, p_session_created_at)`**:
   - Atomic single-session concurrency validator.
   - Locks `user_active_sessions` for the user.
   - If incoming session timestamp is older than active session, returns `FALSE` (rejects).
   - If newer, updates `active_session_id` and returns `TRUE`.
4. **`mark_verified_missing_ads(p_advertiser_id, p_seen_external_ids)`**:
   - Increments `missing_checks` on ads for an advertiser where `provider_ad_ids` does not overlap with `p_seen_external_ids`.
   - When `missing_checks >= 3`, automatically transitions ad `status = 'inactive'` and sets `stop_date = now()`.
5. **`get_search_suggestions(search_query, max_limit)`**:
   - High-speed autocomplete query aggregating distinct advertisers matching search prefix, sorted by active ad count.
6. **`search_brands(query_text, max_results)`**:
   - Full-text brand candidate search returning advertiser summary metadata.
7. **`get_brand_ad_stats(p_advertiser_ids)`**:
   - Computes aggregated ad counts, active ad counts, platform arrays, and running duration across multiple advertisers.

---

## 5. API Endpoints, Server Actions & Core Modules

### 5.1 Next.js REST Route Handlers

#### `POST /api/search` (and alias `POST /api/ads/search`)
- **Auth**: Required (Clerk session + active paid workspace entitlement verified via `requirePaidWorkspaceAccess()`).
- **Input**:
  ```json
  {
    "query": "string (optional, max 160)",
    "brand": "string (optional, max 80)",
    "selectedBrand": { "id": "string", "name": "string", "provider": "meta|foreplay", "providerAdvertiserId": "string" },
    "cursor": "string (optional)",
    "sessionId": "string (optional)",
    "formats": ["image", "video", "carousel"],
    "statuses": ["active", "inactive"],
    "markets": ["US", "IN"],
    "languages": ["en"],
    "niches": ["apparel-fashion"],
    "runtime": { "minDays": 0, "maxDays": 30 },
    "videoLength": { "minSeconds": 0, "maxSeconds": 60 }
  }
  ```
- **Business Logic**:
  1. Checks user credit balance via `getWorkspaceCreditBalance()`. If remaining credits < 15 on a new search, rejects with `402 Payment Required` (`INSUFFICIENT_CREDITS`).
  2. Resolves search intent (`advertiser` vs `keyword`).
  3. Dispatches query to configured provider chain via `getAdProviders()` / `AdsProviderOrchestrator`.
  4. Deduplicates and refines returned ads using `refineAd()` and SHA-256 fingerprinting.
  5. Computes Signal Intelligence `winnerScore` within advertiser context.
  6. Upserts ads into `ads` table via `persistNormalizedAds()`.
  7. Consumes credits via `consumeUsage()` RPC: 15 credits for search + 10 credits per ad delivered.
  8. Triggers background media archival via `after()` hook if `ALLOW_MEDIA_ARCHIVAL=true`.
  9. Signs private Storage URLs via `signArchivedAdMedia()`.
- **Output**:
  ```json
  {
    "ads": [ "NormalizedAd[]" ],
    "nextCursor": "string | null",
    "total": 120,
    "source": "provider | catalog | cache",
    "credits": { "remaining": 2845, "charged": 115 }
  }
  ```

#### `GET /api/ads/[id]`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input**: URL path parameter `id` (supports internal UUID, canonical ad ID `canon_...`, or external ad ID).
- **Business Logic**: Queries `ads` table with `.or(id.eq,canonical_ad_id.eq,external_ad_id.eq)`. Converts to normalized structure, signs media URLs.
- **Output**: `{ "success": true, "ad": "NormalizedAd" }` (or `404 AD_NOT_FOUND`).

#### `POST /api/brands/search`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input**: `{ "query": "Nike" }`
- **Business Logic**: Performs dual-phase lookup: live SearchAPI advertiser probing + catalog database candidate aggregation via `getBrands()`.
- **Output**: `{ "brands": [ "BrandSummary[]" ] }`

#### `GET, POST, PATCH, DELETE /api/competitors`
- **Auth**: Required (Clerk session + paid entitlement).
- **Methods**:
  - `GET`: Returns array of tracked competitors for the authenticated user.
  - `POST`: Adds competitor `{ "advertiserId": "...", "advertiserName": "...", "advertiserAvatarUrl": "..." }`. Sets `sync_status = "syncing"`, awaits `syncCompetitorAds()`, updates `ads_count`, and sets `sync_status = "success"`.
  - `PATCH`: Actions `{ "id": "uuid", "action": "refresh" | "pause" | "resume" }`.
  - `DELETE`: Un-tracks competitor by `?id=uuid` or `?advertiser_id=...`.
- **Output**: Detailed competitor records with sync metadata.

#### `POST /api/feedback`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input**: `multipart/form-data` containing `type`, `message`, `context` (JSON), and optional `attachment` file.
- **Business Logic**:
  1. Inserts record into `support_feedback` table.
  2. If file attached, uploads to private `support-attachments` Supabase Storage bucket.
  3. Forwards form submission and attachment to Deftform API (`https://deftform.com/api/v1/forms/mMbYhG/response`).
- **Output**: `{ "success": true, "id": "uuid" }`

#### `GET, POST /api/integrations/status`
- **Auth**: Required (Clerk session).
- **Methods**:
  - `GET`: Returns cached health and configuration status for Meta, SearchAPI, Foreplay, Google, Supabase.
  - `POST`: Live test triggering real network probes against each third-party provider (rate limited to 5 requests per 10 minutes per IP).
- **Output**: Health state objects `{ configured: boolean, connected: boolean | null, status: string, error?: string }`.

#### `GET, POST /api/saved-filters` and `PATCH, DELETE /api/saved-filters/[id]`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input/Logic**: CRUD endpoints for storing complex JSON filter configurations in `user_saved_filters`. Manages single `is_default` flag.

#### `GET /api/search/suggestions`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input**: Query params `?q=query&limit=10`.
- **Business Logic**: Matches static taxonomy categories (Niches, Styles, Markets) and invokes PostgreSQL `get_search_suggestions` RPC. Falls back to external provider probe with a 60-second in-memory cache.
- **Output**: `{ "query": "...", "suggestions": [ "SearchSuggestion[]" ] }`

#### `POST /api/search/google`
- **Auth**: Required (Clerk session + paid entitlement).
- **Input**: `{ "query": "brand name official website", "cursor": "1", "country": "US" }`
- **Business Logic**: Queries Google Custom Search API, enforcing an in-memory cache (1 hr TTL) and rate limit (15 req/min). Returns organic links and snippets for brand profile enrichment.

#### `GET, POST /api/shared-ads` & `[id]/...`
- **Auth**: Required for management. Public view handled via `/share/[token]`.
- **Endpoints**:
  - `GET /api/shared-ads`: Returns all active, disabled, and expired share links created by the user.
  - `POST /api/shared-ads`: Creates new share link with generated token `rlt_[hex32]`, attaching ads directly or referencing a Swipe File.
  - `POST /api/shared-ads/[id]/enable`: Clears `revoked_at`.
  - `POST /api/shared-ads/[id]/revoke`: Sets `revoked_at = now()`.
  - `POST /api/shared-ads/[id]/visibility`: Toggles `visibility` between `'public'` and `'private'`.

#### `GET, POST /api/swipe-files` & `items`, `memberships`, `ads`
- **Auth**: Required (Clerk session + paid entitlement).
- **Endpoints**:
  - `GET /api/swipe-files`: Lists all user folders and system folder ("Saved Ads").
  - `POST /api/swipe-files`: Creates folder `{ "name": "...", "description": "..." }`.
  - `POST /api/swipe-files/items`: Saves or toggles ad into a folder via `toggleAdInSwipeFile()` or `saveAdToDefaultSwipeFile()`. Resolves UUIDs, canonical IDs, and external IDs.
  - `GET /api/swipe-files/memberships?adId=...`: Returns list of folder IDs containing the specified ad.
  - `GET /api/swipe-files/ads?swipeFileId=...`: Returns array of normalized ads inside the specified folder.

#### `POST /api/webhooks/clerk`
- **Auth**: Unauthenticated HTTP endpoint verified cryptographically via Svix signatures (`svix-id`, `svix-timestamp`, `svix-signature` against `CLERK_WEBHOOK_SIGNING_SECRET`).
- **Events Handled**:
  - `user.created`, `user.updated`: Upserts into `profiles` table.
  - `user.deleted`: Logs deletion (foreign keys cascade).
  - `session.created`: Triggers `verifyAndActivateSession()` to enforce single active session.
  - `session.ended`, `session.revoked`, `session.removed`: Clears active session in `user_active_sessions`.

---

### 5.2 Next.js Server Actions (`"use server"`)

1. **`completeOnboarding()`** (`app/(activation)/welcome/actions.ts`):
   - Authenticates caller via Clerk `auth()`.
   - Updates `profiles.onboarding_completed = true` via Supabase admin.
   - Revalidates layout path `revalidatePath("/", "layout")`.
2. **`cancelSubscription()`** (`app/(workspace)/settings/billing/actions.ts`):
   - Authenticates caller via `requireUser()`.
   - Locates row in `billing_subscriptions` where `workspace_id = userId`.
   - Sets `status = "cancelled"`, keeping `current_period_end` intact so user retains access until period expiry.
   - Revalidates `/settings/billing`.
3. **`inviteTeamMember(email: string)`** (`app/(workspace)/settings/team/actions.ts`):
   - Authenticates caller via `requireUser()`.
   - Resolves plan limits (`resolveWorkspaceAccess`). Enforces that plan allows team invites (Scout plan rejected; requires Hunter or Agency).
   - Enforces seat limit against current usage (`getWorkspaceUsage`).
   - *Current implementation*: Contains a simulated network delay stub (`await new Promise(...)`) awaiting full Clerk Organizations provisioning.

---

### 5.3 Supabase Deno Edge Functions

1. **`billing-create-early-access`** (`supabase/functions/billing-create-early-access/index.ts`):
   - Auth: Clerk Bearer token validated via remote JWKS (`verifyClerkToken`).
   - Input: `{ "customerPhone": "9876543210" }`
   - Business Logic:
     - Validates phone number (10 digits).
     - Checks if workspace already has active access (rejects with 409).
     - Idempotently creates or reuses `billing_payments` intent with `status = 'creating'`.
     - Calls Cashfree Orders API (`POST /orders`) with One-Click Checkout (OCC) payload, return URL (`/billing?order_id={order_id}`), and webhook notification URL.
     - Updates `billing_payments.status = 'active'`.
   - Output: `{ "ok": true, "orderId": "ea_...", "paymentSessionId": "session_...", "mode": "production|sandbox" }`
2. **`billing-verify-early-access`** (`supabase/functions/billing-verify-early-access/index.ts`):
   - Auth: Clerk Bearer token.
   - Input: `{ "orderId": "ea_..." }`
   - Business Logic:
     - Queries Cashfree API directly for both Order (`GET /orders/{order_id}`) and Payments (`GET /orders/{order_id}/payments`).
     - Validates order and payment amounts (₹588.82 / 58882 paise), currency (INR), customer ID, and tags.
     - When payment is verified `SUCCESS`, calls `finalize_early_access_purchase` PostgreSQL RPC.
     - Provisions Early Access grant and 3,000 credits atomically.
   - Output: `{ "ok": true, "active": true, "alreadyProcessed": boolean }`
3. **`cashfree-webhook`** (`supabase/functions/cashfree-webhook/index.ts`):
   - Auth: HMAC-SHA256 signature verification (`x-webhook-signature`, `x-webhook-timestamp`).
   - Business Logic:
     - Idempotently records incoming event in `billing_webhook_events`.
     - Handles `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`.
     - Re-fetches order and payments from Cashfree directly (does not blindly trust webhook payload).
     - Calls `finalize_early_access_purchase` RPC if paid.
4. **`ads-search`** (`supabase/functions/ads-search/index.ts`):
   - Edge function counterpart to `/api/search` allowing direct Edge querying of `AdsProviderOrchestrator` with Clerk token authentication.

---

## 6. Authentication, Authorization & Security Posture

### 6.1 Authentication Strategy
- **Primary Auth Provider**: Clerk (`@clerk/nextjs` `^7.7.4`).
- **Token Mechanism**: Standard Clerk session tokens passed as HTTP-only cookies in the browser, and `Authorization: Bearer <token>` in API calls to Supabase Edge Functions.
- **Identity Synchronization**:
  - Asynchronous: Clerk Svix webhooks (`app/api/webhooks/clerk/route.ts`) sync user creation, updates, and deletion to `public.profiles`.
  - Just-In-Time (JIT) Fallback: `requireUser()` in `lib/auth.ts` inspects `profiles` on each request; if a user record is missing, it fetches user details via Clerk's server SDK `currentUser()` and executes an idempotent upsert.
- **Single Active Session Concurrency Control**:
  - Enforced in `lib/auth-session.ts` and `components/session-boundary.tsx`.
  - When a user logs in, Clerk emits `session.created`. The webhook calls `activate_session_if_newer` PostgreSQL RPC, which updates `public.user_active_sessions`.
  - Any prior active sessions are revoked via Clerk's Backend API (`clerkClient.sessions.revokeSession()`).
  - If a user's session is replaced while they are working, `requireUser()` returns `{ code: "SESSION_REPLACED" }`, the client event fires, SWR cache is wiped, and the user is redirected to `/sign-in?reason=session-replaced`.

---

### 6.2 Authorization & Gating Architecture
Access control operates on a defense-in-depth model across three layers:
1. **Edge / Proxy Layer (`proxy.ts`)**:
   - Executes Next.js 16 Proxy convention (`clerkMiddleware`).
   - Enforces canonical domain redirects (redirects `www.adshunting.com` or plain HTTP to `https://adshunting.com` with HTTP 308).
2. **Route Group Layout Layer (`app/(workspace)/(paid)/layout.tsx`)**:
   - Wraps all premium routes (`/dashboard`, `/discover`, `/brands`, `/competitors`, `/analytics`, `/saved`, `/shared-ads`, `/swipe-files`).
   - Evaluates workspace entitlement via `getWorkspaceEntitlement(userId)`.
   - If `!entitlement.hasAccess`, executes a server-side redirect to `/billing`.
3. **API Route Handler Layer (`requirePaidWorkspaceAccess()`)**:
   - Every protected API endpoint invokes `requirePaidWorkspaceAccess()`.
   - Returns `401 Unauthorized` if not signed in; returns `402 Payment Required` (`{ error: "Payment required.", reason: entitlement.reason }`) if subscription or Early Access is missing.

#### Entitlement Hierarchy
A workspace is granted access if ANY of the following hold true:
- **Platform Owner**: User ID or email matches `creatornavigator@gmail.com` or `profiles.role = 'OWNER'` (unlimited access).
- **Payment Reviewer Bypass**: `ENABLE_PAYMENT_REVIEWER_LOGIN="true"` and user email is in `PAYMENT_REVIEWER_EMAIL`.
- **Early Access Purchase**: Valid `billing_access_grants` row where `grant_type = 'early_access'`.
- **Active Subscription**: Valid `billing_subscriptions` row where `status = 'active'` or `status = 'trialing'` (within trial period) or `status = 'cancelled'` (prior to `current_period_end`).
- **Legacy Grace Period**: Valid `billing_access_grants` row where `grant_type = 'legacy_grace'` and `now() < ends_at`.
- **Development / Preview Bypass**: `NODE_ENV === "development"`, `isPreviewMode`, or `EARLY_ACCESS_BYPASS="true"`.

---

### 6.3 Security Controls & Vulnerability Defenses

| Security Domain | Implementation | Code Location |
| :--- | :--- | :--- |
| **Input Validation** | Strict Zod schemas checking length, regex patterns, and string escaping | `lib/env/server.ts`, `app/api/search/route.ts`, `app/api/competitors/route.ts` |
| **CORS Controls** | Explicit origin handling and method rejection on edge routes | `supabase/functions/_shared/cors.ts` |
| **Rate Limiting** | Sliding window in-memory limiter for sensitive endpoints (Google search, integration tests) | `lib/rate-limit.ts` |
| **Webhook Signatures** | Svix cryptographic verification for Clerk; HMAC-SHA256 signature verification for Cashfree | `app/api/webhooks/clerk/route.ts`, `supabase/functions/_shared/cashfree.ts` |
| **Media Archival Protection** | Private Supabase bucket (`ad-creatives`); access only via short-lived signed URLs (TTL: 3600s) | `lib/media-access.ts` |
| **Idempotency** | UUID idempotency keys on payment creation, credit usage events, and Cashfree requests | `supabase/functions/_shared/cashfree.ts`, `supabase/migrations/20260908120000_credit_schema_refinement.sql` |
| **Database Row Level Security** | RLS enabled across all public tables (`auth.jwt()->>'sub' = user_id`) | `supabase/migrations/*` |

---

## 7. Environment Variables & Infrastructure

### 7.1 Complete Environment Variable Keys (REDACTED)

```env
# ==============================================================================
# APP CORE & RUNTIME
# ==============================================================================
NODE_ENV=
CI=
NEXT_DIST_DIR=
NEXT_RUNTIME=
APP_BASE_URL=
DEV_BYPASS_AUTH=
EARLY_ACCESS_BYPASS=
ENABLE_PAYMENT_REVIEWER_LOGIN=
PAYMENT_REVIEWER_EMAIL=
NEXT_PUBLIC_SUPPORT_EMAIL=
NEXT_PUBLIC_SUPPORT_BOOKING_URL=

# ==============================================================================
# DATABASE & STORAGE (SUPABASE)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# ==============================================================================
# AUTHENTICATION (CLERK)
# ==============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
CLERK_ISSUER=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_URL=
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=

# ==============================================================================
# PAYMENTS (CASHFREE)
# ==============================================================================
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=

# ==============================================================================
# AD SCRAPING & PROVIDERS
# ==============================================================================
ADS_PROVIDER=
ADS_PROVIDER_ORDER=
ADS_PROVIDER_PRIORITY=
ALLOW_MEDIA_ARCHIVAL=

# SearchAPI Pool
SEARCH_API_KEY=
SEARCH_API_KEYS=
SEARCH_API_KEY_1=
SEARCH_API_KEY_2=
SEARCH_API_KEY_3=
SEARCH_API_KEY_4=
SEARCHAPI_API_KEY=

# Foreplay
FOREPLAY_API_KEY=

# Spyglass
SPYGLASS_API_KEY=
SPYGLASS_ENABLED=

# MetaAPI.io (Stubbed)
METAAPI_IO_API_KEY=

# Official Meta Ad Library API
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_LIBRARY_ACCESS_TOKEN=
META_AD_LIBRARY_ENABLED=
META_API_VERSION=
META_GRAPH_API_VERSION=
META_DEFAULT_COUNTRY=
META_API_TIMEOUT_MS=

# ==============================================================================
# ENRICHMENT & SEARCH
# ==============================================================================
GOOGLE_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=

# ==============================================================================
# OBSERVABILITY (SENTRY)
# ==============================================================================
SENTRY_AUTH_TOKEN=
```

---

### 7.2 Deployment & Hosting Configuration
- **Application Hosting**: Built for deployment on Vercel or a standalone Node.js environment via `npm run build` (`next build --webpack`).
- **Edge Infrastructure**: Supabase Cloud / Deno runtime hosting Supabase Edge Functions in `supabase/functions/`. Configured via `supabase/config.toml` (`project_id = "ads_intelligence"`).
- **Next.js Proxy Convention**: Implemented in `proxy.ts`, conforming to Next.js 16's migration away from legacy `middleware.ts`.
- **CI / Build Configuration**:
  - `next.config.mjs` configures `@sentry/nextjs` with source map upload (`silent: !process.env.CI`), client file widening, and `/monitoring` tunnel rewrite.
  - Sentry Vercel Cron Monitor auto-instrumentation enabled.
  - Image remote patterns open to all HTTPS CDNs (`protocol: "https", hostname: "**"`).
  - Server Action body size limit configured to `2mb`.

---

## 8. Codebase Audit: Current State, Technical Debt & Immediate Priorities

### 8.1 Completed & Working Features (Fully Wired End-to-End)
1. **Multi-Provider Search & Ingestion**:
   - `AdsProviderOrchestrator` successfully searches, cascades, and fails over across SearchAPI, official Meta Graph API, Foreplay, and Spyglass.
   - Provider circuit breaker prevents cascading timeouts by tripping after 5 failures and cooling down for 30s.
2. **Signal Intelligence Engine (Winner Score v1.0)**:
   - Evaluates ad longevity, repetition, active variations, and advertiser portfolio commitment. Computes badges (`Emerging Winner`, `Proven Long Runner`, `High-Confidence Winner`).
3. **Canonical Creative Deduplication**:
   - SHA-256 fingerprinting clusters identical ad creatives into canonical groups across campaigns and external IDs.
4. **Swipe Files Management**:
   - Complete many-to-many user collection organization (`swipe_files`, `swipe_file_items`), including default "Saved Ads" auto-creation and membership querying.
5. **Competitor Ad Monitoring**:
   - Adding competitors triggers real-time ad ingestion (`syncCompetitorAds`), tracks sync states (`syncing`, `success`, `error`), and allows pause/resume/refresh.
6. **Cashfree Early Access Checkout Flow**:
   - One-Click Checkout modal integration (`sdk.cashfree.com/js/v3/cashfree.js`).
   - Server-side order creation (`billing-create-early-access`) and authoritative verification (`billing-verify-early-access`).
   - Atomic provisioning of access and 3,000 product credits via `finalize_early_access_purchase` PostgreSQL RPC.
   - HMAC-SHA256 verified webhook handler with idempotent deduplication in `billing_webhook_events`.
7. **Credit Ledger & Enforced Usage**:
   - `report_search_and_delivery_usage` RPC deducts 15 credits per new search and 10 credits per delivered ad.
8. **Shared Ad Links**:
   - Tokenized sharing (`rlt_...`) with configurable public/private access, view counts, and revocation.
9. **Single Active Session Security**:
   - Concurrency locking through Clerk webhooks and Supabase `activate_session_if_newer` RPC.

---

### 8.2 Incomplete / Stubbed Modules & Placeholder Logic
1. **`MetaApiIoProvider` Stub**:
   - `supabase/functions/_shared/ads/providers/metaapiio.ts` contains a stubbed class that immediately throws:
     `throw new ProviderError("UPSTREAM", "MetaAPI.io adapter is not yet implemented.", 501, false);`
2. **Team Member Invitations**:
   - `app/(workspace)/settings/team/actions.ts` checks plan limits and seat allowances but lacks real user invitation logic or Clerk Organization API wiring. Lines 43–48 contain a simulated network delay stub:
     ```typescript
     // If we had a real team members table or Clerk Organizations setup, we would insert/invite here.
     // For now, return success to simulate the backend action working correctly.
     await new Promise(resolve => setTimeout(resolve, 800));
     return { success: true, message: `Invitation sent to ${email}` };
     ```
3. **Empty Legacy Edge Function Directories**:
   - Remnants of the Razorpay-to-Cashfree migration in `supabase/functions/`:
     - `supabase/functions/billing-cancel-subscription/` (empty)
     - `supabase/functions/billing-create-subscription/` (empty)
     - `supabase/functions/billing-reconcile-subscription/` (empty)
     - `supabase/functions/diagnose-billing/` (empty)
     - `supabase/functions/razorpay-webhook/` (empty)
4. **Empty API Route Directories**:
   - `app/api/credits/usage/` (empty directory)
   - `app/api/diag/` (empty directory)
5. **Hunter & Agency Subscription Plans**:
   - In `lib/billing/billing-config.ts`, only `scout` and `early_access` are available. `hunter` and `agency` plans are marked `status: "coming_soon"` with `"Pricing to be announced"`.

---

### 8.3 Technical Debt & High-Risk Findings

1. **CRITICAL SECURITY RISK: Hardcoded Third-Party API Key in Source Code**:
   - In `app/api/feedback/route.ts` line 105, a raw Deftform API bearer token is hardcoded in the repository:
     ```typescript
     headers: {
       "Authorization": "Bearer clUG1XlTfveWtNdgDNXwjGUhrIiXLwA71dci3eCQ76c5e684",
       "Accept": "application/json"
     }
     ```
   - **Remediation**: Invalidate this token immediately in Deftform and move it to `process.env.DEFTFORM_API_TOKEN`.

2. **Hardcoded Platform Owner Identity**:
   - In `lib/platform-owner.ts` line 4, the platform owner email is hardcoded:
     ```typescript
     export const PLATFORM_OWNER_EMAIL = "creatornavigator@gmail.com";
     ```
   - **Remediation**: Migrate to an environment variable (`PLATFORM_OWNER_EMAIL`).

3. **Supabase Row Level Security (RLS) Server Bypass**:
   - In `lib/auth.ts` lines 84–86, `requireUser()` returns the Supabase admin client (`service_role` key) instead of the user's authenticated scoped client:
     ```typescript
     // Bypass Clerk JWT requirement by returning admin client for now
     // const supabase = await createClerkSupabaseServerClient();
     const supabase = admin;
     ```
   - **Impact**: All server queries bypass PostgreSQL RLS policies and rely entirely on application code (`.eq("user_id", auth.userId)`) for data isolation.

4. **In-Memory Rate Limiting on Serverless**:
   - `lib/rate-limit.ts` uses an in-memory JavaScript `Map` (`windows = new Map()`). In a serverless/edge deployment (e.g., Vercel), each serverless lambda instance maintains its own memory space, rendering rate limiting ineffective against distributed abuse.
   - **Remediation**: Migrate to Upstash Redis (`@upstash/ratelimit`).

5. **N+1 Database Queries on Home Dashboard**:
   - In `lib/dashboard.ts` lines 56–59, active ad counts for tracked competitors are executed inside an un-batched `Promise.all` map:
     ```typescript
     const tracked = await Promise.all(competitorRows.map(async (competitor) => {
       const activeAds = await countRows("Home.competitorActiveAds", () =>
         adminSupabase.from("ads").select("*", { count: "exact", head: true })
           .eq("advertiser_id", competitor.advertiser_id).eq("status", "active")
       );
       return { name: competitor.advertiser_name, advertiserId: competitor.advertiser_id, activeAds: activeAds ?? 0 };
     }));
     ```
   - **Remediation**: Utilize the existing `get_brand_ad_stats` RPC to aggregate competitor counts in a single query.

6. **Unbounded Memory Scan in Analytics**:
   - In `lib/analytics.ts` line 4, `getAnalytics()` pulls up to 2,000 raw ad rows into memory and performs array filtering/reducing in JavaScript:
     ```typescript
     const { data } = await supabase.from("ads").select("status,running_days,media_type,cta,platforms,start_date").limit(2000);
     ```
   - **Remediation**: Move aggregation to SQL database queries (`COUNT(*)`, `AVG(running_days)`, `GROUP BY media_type`).

7. **ESLint Failures Across Codebase**:
   - Running `npm run lint` yields **57 problems (40 errors, 17 warnings)** due to `no-explicit-any` in `app/api/search/route.ts`, `no-require-imports` in root diagnostic scripts, and unused variables.

8. **Test Suite Desynchronization**:
   - Running `node --require ./tests/register-typescript.cjs --test tests/*.test.ts` fails on `tests/early-access.test.ts`. Commit `de57cf98` updated the Cashfree API version in code to `2023-08-01`, but the test assertion still expects the outdated string `2026-01-01`.

---

### 8.4 Recent Git Activity

The last 10 commits on `main` confirm active engineering momentum transitioning billing infrastructure from Razorpay to Cashfree One-Click Checkout:

```
b089a390 fix: cashfree payment verification mismatch and checkout redirection
c2bd3353 chore(billing): clean up unused variables in edge function
c2e6297c fix(billing): fix order_tags validation errors for OCC
33657394 feat(billing): auto-detect Cashfree environment based on App ID prefix
b49b2490 chore: clean up patch file
13faf49b fix(billing): implement backend tracking and fix frontend error parser
820d668e fix(billing): resolve TypeScript type mismatch for paymentId and orderId
9e1794e4 fix(billing): resolve Cashfree Early Access checkout failures
de57cf98 fix(billing): resolve Cashfree checkout crash and invalid API version
894c846a feat(billing): migrate from Razorpay to Cashfree and implement early access checkout
```

