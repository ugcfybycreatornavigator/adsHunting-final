import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { dbAdToNormalized, type DatabaseAdRow } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { requirePaidWorkspaceAccessForUser } from "@/lib/billing/entitlement";
import { getWorkspaceCreditBalance, consumeUsage, CREDIT_COSTS } from "@/lib/billing/usage";
import crypto from "crypto";
import { ProviderError } from "@/lib/providers/errors";
import { adsForClient, persistNormalizedAds, archiveAdsInBackground } from "@/lib/ads-persistence";
import { isPreviewMode } from "@/lib/preview";
import type { AdSearchFilters, AdSearchResult, NormalizedAd, SearchIntent } from "@/lib/types";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";
import { auth } from "@clerk/nextjs/server";
import { getServerEnv } from "@/lib/env/server";
import { brandFromRow, realAdvertiserName, resolveAdIdentities } from "@/lib/advertiser-identity";
import { getAdProviders } from "@/lib/providers";
import { calculateWinnerScore } from "@/lib/intelligence";
import { signArchivedAdMedia } from "@/lib/media-access";
import { rankRelevantAds, searchTokens } from "@/lib/search-relevance";

const schema = z.object({
  query: z.string().trim().max(160).optional(),
  brand: z.string().max(80).optional(),
  selectedBrand: z.object({
    id: z.string().min(1).max(80), name: z.string().trim().min(1).max(300),
    provider: z.enum(["meta", "foreplay"]), providerAdvertiserId: z.string().min(1).max(80),
    logoUrl: z.string().url().max(4000).nullable().optional(),
    profileUrl: z.string().url().max(4000).nullable().optional(),
    domain: z.string().max(300).nullable().optional(),
  }).optional(),
  platforms: z.array(z.enum(["facebook", "instagram", "messenger", "audience_network", "threads"])).max(5).optional(),
  sort: z.string().max(32).optional(),
  cursor: z.string().max(16_000).optional(),
  sessionId: z.string().max(64).optional(),
  cta: z.string().max(40).optional(),
  source: z.literal("competitor").optional(),

  // Legacy singular
  status: z.enum(["all", "active", "inactive"]).default("all"),
  country: z.string().max(8).optional(),
  mediaType: z.enum(["all", "image", "video", "carousel", "unknown"]).optional(),
  language: z.string().max(16).optional(),
  duration: z.string().max(20).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),

  // New plural
  formats: z.array(z.enum(["image", "video", "carousel", "unknown"])).optional(),
  statuses: z.array(z.enum(["active", "inactive", "unknown"])).optional(),
  markets: z.array(z.string().max(8)).optional(),
  languages: z.array(z.string().max(16)).optional(),
  niches: z.array(z.string().max(32)).optional(),
  contentStyles: z.array(z.string().max(32)).optional(),

  runtime: z.object({
    preset: z.string().optional(),
    minDays: z.number().nonnegative().optional(),
    maxDays: z.number().nonnegative().optional(),
  }).optional(),

  videoLength: z.object({
    preset: z.string().optional(),
    minSeconds: z.number().nonnegative().optional(),
    maxSeconds: z.number().nonnegative().optional(),
  }).optional(),
});

const inFlight = new Map<string, Promise<AdSearchResult>>();
const DEFAULT_FEED_SAMPLE_SIZE = 120;

const AD_CATALOG_COLUMNS = [
  "id",
  "canonical_ad_id",
  "external_ad_id",
  "advertiser_id",
  "advertiser_name",
  "advertiser_avatar_url",
  "advertiser_profile_url",
  "body",
  "headline",
  "description",
  "cta",
  "landing_page_url",
  "source_media_url",
  "thumbnail_url",
  "media_type",
  "status",
  "start_date",
  "stop_date",
  "first_seen_at",
  "last_seen_at",
  "running_days",
  "country",
  "platforms",
  "quality_score",
  "source",
  "carousel_assets",
  "archive_status",
  "refined_data",
].join(",");

interface CatalogAdsCacheEntry {
  expiresAt: number;
  ads: NormalizedAd[];
  nextCursor: string | null;
  total: number | null;
}
const searchCache = new Map<string, CatalogAdsCacheEntry>();
const MAX_SEARCH_CACHE_ENTRIES = 200;
const SEARCH_CACHE_TTL_MS = 45_000; // 45 seconds

function searchResponse(body: unknown, requestId: string, startedAt: number, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Server-Timing", `total;dur=${Math.round(performance.now() - startedAt)}`);
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  try {
    let catalogClient: Awaited<ReturnType<typeof requireUser>>["supabase"] = null;
    const authRes = await requireUser();
    if (authRes.error || !authRes.user) return authRes.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    catalogClient = authRes.supabase;

    const rawBody = await request.json().catch(() => ({}));
    const cleanBody = Object.fromEntries(
      Object.entries(rawBody).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
      )
    );

    const isNewSearch = !rawBody?.cursor;
    const baseCost = isNewSearch ? CREDIT_COSTS.AD_SEARCH : 0;

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateLimitKey = `search:${authRes.user.id || `ip:${ip}`}`;
    const accessError = await requirePaidWorkspaceAccessForUser(authRes.user.id);
    if (accessError) return accessError;

    const [balance, limit] = await Promise.all([
      getWorkspaceCreditBalance(authRes.user.id),
      rateLimit(rateLimitKey, 40, 60_000, { policy: "fail-closed" }),
    ]);

    if (balance && !balance.unlimited && baseCost > 0 && balance.creditsRemaining !== null && balance.creditsRemaining < baseCost) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS", reason: "out_of_credits", creditsRemaining: balance.creditsRemaining, code: "INSUFFICIENT_CREDITS" },
        { status: 402 }
      );
    }

  if (isSupabaseConfigured && !isPreviewMode) {
    // Already authenticated above
  } else if (isSupabaseConfigured && isPreviewMode) {
    // Already authenticated above
  }
  if (!limit.allowed) {
    if (limit.source === "fail-closed") {
      return NextResponse.json(
        { error: "Search rate verification is temporarily unavailable. Please retry shortly.", code: "RATE_LIMIT_UNAVAILABLE" },
        { status: 503, headers: { "Retry-After": String(limit.retryAfter || 5) } }
      );
    }
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const parsed = schema.safeParse(cleanBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search filters.", code: "INVALID_FILTERS", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const filters = normalizeDiscoverFilters(parsed.data);

  // Prefer the existing catalog mapping over client navigation context.
  if (filters.brand && catalogClient) {
    const { data } = await catalogClient.from("ads").select("*")
      .eq("advertiser_id", filters.brand).order("last_seen_at", { ascending: false }).limit(100);
    const known = (data || []).map(brandFromRow).find(brand => brand &&
      (!filters.selectedBrand || brand.provider === filters.selectedBrand.provider));
    if (known) filters.selectedBrand = known;
  }
  let resolvedIntent: SearchIntent | undefined = undefined;

  if (filters.brand) {
    resolvedIntent = { type: "advertiser", advertiserId: filters.brand, advertiserName: filters.selectedBrand?.name || "" };
  } else if (filters.query) {
    resolvedIntent = { type: "keyword", query: filters.query };
  }

  // Sort array fields for stable cache key
  const normalizedFilters = { ...filters };
  if (normalizedFilters.platforms) normalizedFilters.platforms.sort();
  if (normalizedFilters.formats) normalizedFilters.formats.sort();
  if (normalizedFilters.statuses) normalizedFilters.statuses.sort();
  if (normalizedFilters.markets) normalizedFilters.markets.sort();
  if (normalizedFilters.languages) normalizedFilters.languages.sort();
  if (normalizedFilters.niches) normalizedFilters.niches.sort();
  if (normalizedFilters.contentStyles) normalizedFilters.contentStyles.sort();

  const sessionId = parsed.data.sessionId || requestId;

  const searchFingerprint = crypto.createHash("sha256").update(
    (filters.brand ? "BRAND:" : "SEARCH:") +
    (filters.query || "") + ":" +
    JSON.stringify({
      brand: filters.brand,
      platforms: normalizedFilters.platforms,
      sort: normalizedFilters.sort,
      formats: normalizedFilters.formats,
      statuses: normalizedFilters.statuses,
      markets: normalizedFilters.markets,
      languages: normalizedFilters.languages,
      niches: normalizedFilters.niches,
      contentStyles: normalizedFilters.contentStyles,
      country: normalizedFilters.country,
      mediaType: normalizedFilters.mediaType,
      status: normalizedFilters.status,
      cta: normalizedFilters.cta,
      runtime: normalizedFilters.runtime,
      startDate: normalizedFilters.startDate,
      endDate: normalizedFilters.endDate
    })
  ).digest("hex");

  const providerRequestKey = JSON.stringify(normalizedFilters);
  const cacheKey = `${searchFingerprint}:${filters.cursor || "0"}:${filters.query || filters.brand ? "shared" : sessionId}`;
  let payload: AdSearchResult | null = null;
  let isCacheHit = false;

  if (filters.source !== "competitor") {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      payload = {
        ads: cached.ads,
        nextCursor: cached.nextCursor,
        total: cached.total,
        source: "catalog",
        brand: filters.selectedBrand,
        resolvedIntent,
      };
      isCacheHit = true;
    }
  }

  // 1. Check Supabase preload/cache first if query is empty or requesting discovery feed
    // For competitors, ALWAYS use the DB because their ads are synced manually.
    if (!payload && isSupabaseConfigured && (!filters.cursor || /^\d+$/.test(filters.cursor))) {
      try {
        let query = catalogClient!.from("ads").select(AD_CATALOG_COLUMNS);
        const defaultFeed = !filters.query && !filters.brand;
        if (filters.brand) query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
        else if (filters.query) {
          const tokens = searchTokens(filters.query).slice(0, 4);
          if (tokens.length > 1) {
            for (const token of tokens) {
              query = query.or(buildTokenSearchOr(token));
            }
          } else {
            query = query.or(buildCatalogSearchOr(filters.query));
          }
        } else {
          query = query.not("advertiser_name", "is", null).neq("advertiser_name", "");
        }
        if (filters.selectedBrand) query = query.in("source", filters.selectedBrand.provider === "meta" ? ["meta", "meta_official", "searchapi", "metaapi_io"] : ["foreplay"]);

        // Apply Plural filters
        if (filters.formats?.length) query = query.in("media_type", filters.formats);
        if (filters.statuses?.length) query = query.in("status", filters.statuses);
        if (filters.markets?.length) query = query.in("country", filters.markets);
        if (filters.platforms?.length) query = query.contains("platforms", filters.platforms);

        // Legacy singular filters
        if (filters.status && filters.status !== "all" && !filters.statuses?.length) query = query.eq("status", filters.status);
        if (filters.mediaType && filters.mediaType !== "all" && !filters.formats?.length) query = query.eq("media_type", filters.mediaType);
        if (filters.country && filters.country !== "ALL" && !filters.markets?.length) query = query.eq("country", filters.country);
        if (filters.cta) query = query.ilike("cta", `%${filters.cta}%`);

        if (filters.runtime) {
          if (filters.runtime.minDays !== undefined) query = query.gte("running_days", filters.runtime.minDays);
          if (filters.runtime.maxDays !== undefined) query = query.lte("running_days", filters.runtime.maxDays);
        }

        // Determine pagination
        const limit = 30;
        const offset = filters.cursor ? parseInt(filters.cursor, 10) : 0;
        const seed = hashStringToSeed(sessionId);

        // Apply sort
        if (filters.sort === "newest") {
          query = query.order("start_date", { ascending: false, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "oldest") {
          query = query.order("start_date", { ascending: true, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "longest") {
          query = query.order("running_days", { ascending: false, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "variations") {
          query = query.order("last_seen_at", { ascending: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else {
          // "relevant" - discovery feed or relevance
          if (filters.brand) {
            query = query.order("start_date", { ascending: false, nullsFirst: false });
            query = query.order("canonical_ad_id", { ascending: true });
          } else {
            query = query.order("last_seen_at", { ascending: false });
            query = query.order("canonical_ad_id", { ascending: true });
          }
        }

        let rangeStart: number;
        let rangeEnd: number;
        const candidateBatchSize = defaultFeed ? Math.min(limit * 2, DEFAULT_FEED_SAMPLE_SIZE) : (filters.query ? DEFAULT_FEED_SAMPLE_SIZE : limit);

        if (defaultFeed) {
          // Diverse discover feed: deterministic session base window with candidate batch size
          const sessionBase = (seed % 10) * candidateBatchSize;
          rangeStart = sessionBase + offset;
          rangeEnd = rangeStart + candidateBatchSize - 1;
        } else {
          rangeStart = offset;
          rangeEnd = offset + candidateBatchSize - 1;
        }
        query = query.range(rangeStart, rangeEnd);

        const { data, error } = await query;

        if (!error && data) {
          const sampleRows = data as unknown as DatabaseAdRow[];
          const hasMore = sampleRows.length >= (defaultFeed ? limit : limit);
          const sourceData = defaultFeed
            ? takeDefaultFeed(sampleRows, limit, filters, seed + offset)
            : sampleRows.map(dbAdToNormalized).filter(ad => matchesClientFilters(ad, filters));

          const canonical = sampleRows.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
          let ads = ensureWinnerScores(resolveAdIdentities(sourceData, canonical, filters.selectedBrand, filters.brand));

          ads = rankRelevantAds(ads, filters.query).slice(0, limit);

          const nextCursor = hasMore ? (offset + candidateBatchSize).toString() : null;

          if (ads.length || filters.source === "competitor" || filters.cursor) payload = {
            ads: adsForClient(ads),
            nextCursor,
            total: defaultFeed ? ads.length : data.length,
            source: "catalog"
          };
        } else if (filters.source === "competitor") {
          // Force empty payload if competitor has no ads, bypassing provider fallback
          payload = { ads: [], nextCursor: null, total: 0, source: "catalog" };
        }
      } catch (err) {
        console.error("[DiscoverAds] Supabase error:", err);
      }
    }

    // 2. Call provider if not satisfied by preloaded cache (e.g. we have a search query)
    const hasLiveSearchIntent = Boolean(filters.query?.trim() || filters.brand);

    let canUseProvider = false;
    let capabilityMismatch = false;
    try {
      if (hasLiveSearchIntent) {
        getAdProviders(filters);
        canUseProvider = true;
      }
    } catch {
      capabilityMismatch = true;
    }

    if (!payload && filters.source !== "competitor" && hasLiveSearchIntent && canUseProvider) {
      let providerError: unknown = null;
      let executedResult: AdSearchResult | null = null;

      // 1. Primary: Direct high-speed provider execution via Next.js server with in-flight deduplication
      try {
        const providers = getAdProviders(filters);
        if (providers.length > 0) {
          const inFlightKey = `provider:${providerRequestKey}`;
          let pending = inFlight.get(inFlightKey);
          if (!pending) {
            pending = providers[0].provider.searchAds(filters).finally(() => inFlight.delete(inFlightKey));
            inFlight.set(inFlightKey, pending);
          }
          executedResult = await pending;
        }
      } catch (err) {
        console.warn(`[AdsSearch][requestId=${requestId}] Direct provider execution failed, attempting Edge Function:`, err);
        providerError = err;
      }

      // 2. Fallback: Supabase Edge Function
      if (!executedResult && isSupabaseConfigured) {
        try {
          const { getToken } = await auth();
          const token = await getToken();
          if (token) {
            const env = getServerEnv();
            const functionUrl = `${env.supabaseUrl}/functions/v1/ads-search`;
            const edgeRes = await fetch(functionUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ ...filters, requestId }),
              signal: AbortSignal.timeout(12_000)
            });
            if (edgeRes.ok) {
              executedResult = await edgeRes.json();
              providerError = null;
            }
          }
        } catch (edgeErr) {
          console.warn(`[AdsSearch][requestId=${requestId}] Edge function execution failed:`, edgeErr);
          if (!providerError) providerError = edgeErr;
        }
      }

      // 3. Process and persist obtained ads
      if (executedResult && executedResult.ads) {
        const ids = [...new Set(executedResult.ads.map(ad => ad.advertiser?.id).filter((id): id is string => Boolean(id)))];
        const { data: mappings } = ids.length && catalogClient
          ? await catalogClient.from("ads").select("*").in("advertiser_id", ids).limit(1000)
          : { data: [] };
        const canonical = (mappings || []).map(brandFromRow).filter((b): b is NonNullable<typeof b> => Boolean(b));
        executedResult.ads = ensureWinnerScores(resolveAdIdentities(executedResult.ads, canonical, filters.selectedBrand, filters.brand));

        if (executedResult.ads.length > 0) {
          const dedupMap = new Map<string, NormalizedAd>();
          for (const ad of executedResult.ads) {
            if (!dedupMap.has(ad.id)) {
              dedupMap.set(ad.id, ad);
            }
          }
          executedResult.ads = Array.from(dedupMap.values());

          const adsToArchive = executedResult.ads;
          if (catalogClient) {
            const persistence = await persistNormalizedAds(adsToArchive);
            if (persistence.error) console.warn("[AdsSearch] Persistence warning:", persistence.error);
            after(() => archiveAdsInBackground(adsToArchive));
          }

          const uiDedupMap = new Map<string, NormalizedAd>();
          for (const ad of executedResult.ads) {
            const groupId = ad.fingerprint || ad.id;
            if (!uiDedupMap.has(groupId)) {
              uiDedupMap.set(groupId, ad);
            }
          }
          const uiAds = rankRelevantAds(Array.from(uiDedupMap.values()), filters.query);
          payload = { ...executedResult, ads: adsForClient(uiAds), requestId };
        } else {
          payload = { ...executedResult, ads: [], requestId };
        }
      }

      // 4. Cache fallback if no ads obtained from provider
      if (!payload && catalogClient) {
        if (providerError) console.info(`[AdsSearch][requestId=${requestId}] Attempting query-aware cache fallback after provider error`);
        else if (capabilityMismatch) console.info(`[AdsSearch][requestId=${requestId}] Using local corpus due to provider capability mismatch`);
        try {
          let query = catalogClient.from("ads").select(AD_CATALOG_COLUMNS);

          if (filters.brand) {
            query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
          } else if (filters.query) {
            const tokens = searchTokens(filters.query).slice(0, 4);
            if (tokens.length > 1) {
              for (const token of tokens) {
                query = query.or(buildTokenSearchOr(token));
              }
            } else {
              query = query.or(buildCatalogSearchOr(filters.query));
            }
          }

          if (filters.formats?.length) query = query.in("media_type", filters.formats);
          if (filters.statuses?.length) query = query.in("status", filters.statuses);
          if (filters.markets?.length) query = query.in("country", filters.markets);
          if (filters.platforms?.length) query = query.contains("platforms", filters.platforms);

          if (filters.status && filters.status !== "all" && !filters.statuses?.length) query = query.eq("status", filters.status);
          if (filters.mediaType && filters.mediaType !== "all" && !filters.formats?.length) query = query.eq("media_type", filters.mediaType);
          if (filters.country && filters.country !== "ALL" && !filters.markets?.length) query = query.eq("country", filters.country);
          if (filters.cta) query = query.ilike("cta", `%${filters.cta}%`);

          query = query.order("last_seen_at", { ascending: false }).limit(25);

          const offset = filters.cursor ? parseInt(filters.cursor, 10) : 0;
          if (offset > 0) {
            query = query.range(offset, offset + 24);
          }

          const { data } = await query;
          if (data && data.length > 0) {
            const rows = data as unknown as DatabaseAdRow[];
            const canonical = rows.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
            const resolved = ensureWinnerScores(resolveAdIdentities(rows.map(dbAdToNormalized), canonical, filters.selectedBrand, filters.brand));
            let deduplicated = Array.from(new Map(resolved.map(ad => [ad.id, ad])).values());
            if (filters.query) {
              deduplicated = rankRelevantAds(deduplicated, filters.query);
            }
            if (deduplicated.length) {
              payload = {
                ads: adsForClient(deduplicated),
                nextCursor: data.length === 25 ? (offset + 25).toString() : null,
                total: data.length,
                source: "cache",
                stale: true,
                degraded: true,
                requestId
              } as AdSearchResult & { stale: boolean; degraded: boolean; requestId: string };
            }
          }
        } catch (cacheErr) {
          console.error(`[AdsSearch][requestId=${requestId}] Cache fallback error:`, cacheErr);
        }
      }

      if (!payload && providerError) {
        throw providerError;
      }
    }

    if (payload) {
      payload.ads = rankRelevantAds(ensureWinnerScores(resolveAdIdentities(payload.ads, [], filters.selectedBrand, filters.brand)), filters.query);
      payload.ads = await signArchivedAdMedia(payload.ads);
      payload.brand = filters.selectedBrand;
      payload.resolvedIntent = resolvedIntent;
      payload.requestId = requestId;

      // Track user search queries and brand searches asynchronously in background
      const searchQueryText = filters.query || (filters.brand ? `Brand: ${filters.brand}` : null);
      if (searchQueryText && authRes.user && catalogClient) {
        const userId = authRes.user.id;
        const finalQuery = searchQueryText.slice(0, 160);
        after(async () => {
          try {
            await catalogClient
              .from("search_history")
              .insert({
                user_id: userId,
                query: finalQuery,
                searched_at: new Date().toISOString(),
              });
          } catch (trackingErr) {
            console.error("[SearchTracking] Failed to log search history:", trackingErr);
          }
        });
      }

      let finalCredits = null;
      if (payload && payload.ads && filters.source !== "competitor") {
        const deliveryAdIds = payload.ads.map(ad => (ad as { canonical_ad_id?: string; id: string }).canonical_ad_id || ad.id).filter((id): id is string => Boolean(id));
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

        if (usageResult && usageResult.success && !usageResult.unlimited) {
          if (usageResult.baseCharged === false && baseCost > 0 && usageResult.creditsRemaining !== undefined && usageResult.creditsRemaining < baseCost) {
            return NextResponse.json(
              { error: "INSUFFICIENT_CREDITS", reason: "out_of_credits_concurrent", code: "INSUFFICIENT_CREDITS" },
              { status: 402 }
            );
          }

          const acceptedIds = new Set(usageResult.acceptedAdIds || []);
          payload.ads = payload.ads.filter(ad => acceptedIds.has((ad as { canonical_ad_id?: string; id: string }).canonical_ad_id || ad.id));

          finalCredits = {
            unlimited: false,
            allocated: usageResult.creditsAllocated,
            used: usageResult.creditsUsed,
            remaining: usageResult.creditsRemaining,
            chargedThisRequest: usageResult.creditsChargedThisRequest
          };
        } else if (usageResult && usageResult.unlimited) {
          finalCredits = {
            unlimited: true,
            allocated: null,
            used: null,
            remaining: null,
            chargedThisRequest: 0
          };
        }
      }

      if (finalCredits) {
        payload.credits = finalCredits;
      }
      payload.sessionId = sessionId;

      if (!isCacheHit && payload.ads && payload.ads.length > 0 && filters.source !== "competitor") {
        if (searchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
          const oldest = searchCache.keys().next().value;
          if (oldest) searchCache.delete(oldest);
        }
        searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          ads: payload.ads,
          nextCursor: payload.nextCursor,
          total: payload.total,
        });
      }

      return searchResponse(payload, requestId, startedAt, { headers: { "Cache-Control": "no-store", "X-Cache": isCacheHit ? "HIT" : "MISS" } });
    }

    payload = { ads: [], nextCursor: null, total: 0, source: "catalog", brand: filters.selectedBrand, resolvedIntent, requestId, sessionId };
    return searchResponse(payload, requestId, startedAt, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProviderError) {
      return searchResponse({ success: false, code: error.code, message: error.message, requestId, retryable: error.status >= 500 || error.status === 429 || error.status === 408 }, requestId, startedAt, { status: error.status });
    }
    return searchResponse(
      { success: false, code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable.", requestId, retryable: true },
      requestId,
      startedAt,
      { status: 502 }
    );
  }
}


function hashStringToSeed(str: string): number {
  let hash = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function interleaveDiverseAds(
  ads: NormalizedAd[],
  prng: () => number,
  maxPerBrand = 2
): NormalizedAd[] {
  if (ads.length <= 1) return ads;

  // 1. Group ads into buckets by brand/advertiser
  const brandBuckets = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const brandKey = ad.advertiser?.id || realAdvertiserName(ad.advertiser?.name) || ad.id;
    if (!brandBuckets.has(brandKey)) brandBuckets.set(brandKey, []);
    brandBuckets.get(brandKey)!.push(ad);
  }

  // 2. Cap each brand bucket to maxPerBrand and seeded shuffle
  const buckets: NormalizedAd[][] = [];
  for (const [, bucketAds] of brandBuckets) {
    for (let i = bucketAds.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [bucketAds[i], bucketAds[j]] = [bucketAds[j], bucketAds[i]];
    }
    buckets.push(bucketAds.slice(0, maxPerBrand));
  }

  // 3. Shuffle bucket order with PRNG
  for (let i = buckets.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
  }

  // 4. Round-robin interleave across buckets
  const interleaved: NormalizedAd[] = [];
  let round = 0;
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const bucket of buckets) {
      if (round < bucket.length) {
        interleaved.push(bucket[round]);
        if (round + 1 < bucket.length) {
          hasMore = true;
        }
      }
    }
    round++;
  }

  return interleaved;
}

function buildTokenSearchOr(token: string) {
  const escaped = token.replace(/[%_,().]/g, " ").trim();
  return ["headline", "body", "description", "advertiser_name", "cta"]
    .map(field => `${field}.ilike.%${escaped}%`)
    .join(",");
}

function buildCatalogSearchOr(query: string) {
  const tokens = searchTokens(query).slice(0, 8);
  return tokens.flatMap(token => {
    const escaped = token.replace(/[%_,().]/g, " ").trim();
    return ["headline", "body", "description", "advertiser_name", "cta"]
      .map(field => `${field}.ilike.%${escaped}%`);
  }).join(",");
}

function takeDefaultFeed(
  rows: Parameters<typeof dbAdToNormalized>[0][],
  limit: number,
  filters: AdSearchFilters,
  seed: number
) {
  const prng = mulberry32(seed);
  const normalized = rows
    .map(row => resolveAdIdentities([dbAdToNormalized(row)], brandFromRow(row) ? [brandFromRow(row)!] : [])[0])
    .filter(ad => realAdvertiserName(ad.advertiser?.name, ad.advertiser?.id))
    .filter(ad => matchesClientFilters(ad, filters));

  const interleaved = interleaveDiverseAds(normalized, prng, 2);
  return interleaved.slice(0, limit);
}

function matchesClientFilters(ad: NormalizedAd, filters: AdSearchFilters) {
  if (filters.languages?.length && !filters.languages.some(value => ad.delivery.countries.includes(value.toUpperCase()))) return false;

  if (filters.niches?.length) {
    const nicheMatches = filters.niches.some(niche => {
      const target = niche.toLowerCase().trim();
      const nicheId = ad.intelligence?.nicheId?.toLowerCase();
      if (nicheId && nicheId === target) return true;
      const cat = ad.intelligence?.category?.toLowerCase();
      if (cat) {
        if (cat === target) return true;
        if (cat.replace(/[^a-z0-9]+/g, "-") === target) return true;
        if (target.replace(/-/g, " ") === cat) return true;
      }
      const copyText = `${ad.copy?.headline || ""} ${ad.copy?.primaryText || ""} ${ad.copy?.description || ""}`.toLowerCase();
      return copyText.includes(target.replace(/-/g, " "));
    });
    if (!nicheMatches) return false;
  }

  if (filters.contentStyles?.length) {
    const haystack = [
      ad.intelligence?.creativeFormat,
      ad.intelligence?.hookType,
      ad.intelligence?.offerType,
      ...(ad.intelligence?.labels || []),
      ad.copy?.headline,
      ad.copy?.primaryText,
      ad.copy?.description,
    ].filter(Boolean).join(" ").toLowerCase();
    if (!filters.contentStyles.some(value => haystack.includes(value.toLowerCase()))) return false;
  }

  return true;
}

function ensureWinnerScores(ads: NormalizedAd[]) {
  const byAdvertiser = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const key = ad.advertiser?.id || ad.advertiser?.name || "unknown";
    if (!byAdvertiser.has(key)) byAdvertiser.set(key, []);
    byAdvertiser.get(key)!.push(ad);
  }
  return ads.map(ad => {
    const hasEvidence = ad.delivery?.status === "active" ||
      (ad.delivery?.daysRunning ?? 0) > 0 ||
      (ad.variants ?? 1) > 1 ||
      Boolean(ad.destination?.url) ||
      Boolean(ad.delivery?.countries?.length);
    if ((ad.intelligence?.winnerScore ?? null) !== 0 || !hasEvidence) return ad;
    return {
      ...ad,
      intelligence: {
        ...ad.intelligence,
        winnerScore: calculateWinnerScore(ad, { advertiserAds: byAdvertiser.get(ad.advertiser?.id || ad.advertiser?.name || "unknown") || [ad] }),
      },
    };
  });
}
