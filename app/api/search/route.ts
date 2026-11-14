import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { dbAdToNormalized } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
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
import { resolveAdMedia } from "@/lib/media";
import { calculateWinnerScore } from "@/lib/intelligence";
import { signArchivedAdMedia } from "@/lib/media-access";

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
    const accessError = await requirePaidWorkspaceAccess();
    if (accessError) return accessError;

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

    const balance = await getWorkspaceCreditBalance(authRes.user.id);
    const isNewSearch = !rawBody?.cursor;
    const baseCost = isNewSearch ? CREDIT_COSTS.AD_SEARCH : 0;

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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateLimitKey = authRes.user ? `search:${authRes.user.id}` : `search:ip:${ip}`;
  const limit = await rateLimit(rateLimitKey, 40, 60_000, { policy: "fail-closed" });
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

  let payload: AdSearchResult | null = null;

  // 1. Check Supabase preload/cache first if query is empty or requesting discovery feed
    // For competitors, ALWAYS use the DB because their ads are synced manually.
    if (isSupabaseConfigured && (!filters.cursor || /^\d+$/.test(filters.cursor))) {
      try {
        let query = catalogClient!.from("ads").select("*", { count: "exact" });
        const defaultFeed = !filters.query && !filters.brand;
        const hasActiveFilters = Boolean(
          filters.formats?.length || filters.statuses?.length || filters.markets?.length ||
          filters.platforms?.length || filters.country && filters.country !== "ALL" ||
          filters.status && filters.status !== "all" || filters.mediaType && filters.mediaType !== "all" ||
          filters.cta || filters.runtime || filters.startDate || filters.endDate
        );
        if (filters.brand) query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
        else if (filters.query) {
          const q = filters.query.replace(/[%_,().]/g, " ").trim();
          query = query.or(`headline.ilike.%${q}%,body.ilike.%${q}%,advertiser_name.ilike.%${q}%`);
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
          // Fallback if variations sort isn't natively supported on DB
          query = query.order("last_seen_at", { ascending: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else {
          // "relevant" - use a seeded pseudo-random sort for variety if it's a brand profile, otherwise newest
          if (filters.brand) {
            // Postgres lacks a simple seeded random for string IDs without extension,
            // but we can sort by last_seen_at DESC as a stable proxy,
            // or simply canonical_ad_id for stability.
            // A more varied feed can be simulated by ordering by start_date DESC.
            query = query.order("start_date", { ascending: false, nullsFirst: false });
            query = query.order("canonical_ad_id", { ascending: true });
          } else {
            query = query.order("last_seen_at", { ascending: false });
            query = query.order("canonical_ad_id", { ascending: true });
          }
        }

        let rangeStart = offset;
        let rangeEnd = offset + limit;
        if (defaultFeed && !filters.cursor && !hasActiveFilters) {
          const { count } = await catalogClient!.from("ads").select("id", { count: "exact", head: true })
            .not("advertiser_name", "is", null).neq("advertiser_name", "");
          const maxStart = Math.max(0, (count || 0) - DEFAULT_FEED_SAMPLE_SIZE);
          rangeStart = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0;
          rangeEnd = rangeStart + DEFAULT_FEED_SAMPLE_SIZE - 1;
        } else if (defaultFeed) {
          rangeEnd = offset + DEFAULT_FEED_SAMPLE_SIZE - 1;
        }
        query = query.range(rangeStart, rangeEnd);

        const { data, error } = await query;

        if (!error && data) {
          const sampleRows = data;
          const hasMore = sampleRows.length > limit;
          const sourceData = defaultFeed
            ? takeDefaultFeed(sampleRows, limit, filters)
            : (hasMore ? data.slice(0, limit) : data).map(dbAdToNormalized);
          const renderableSourceData = sourceData.filter(hasRenderableMedia);
          const pagedData = hasMore ? data.slice(0, limit) : data;

          const canonical = data.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
          const ads = ensureWinnerScores(resolveAdIdentities(renderableSourceData, canonical, filters.selectedBrand, filters.brand));

          // No longer deduplicating aggressively by ad.id because canonical_ad_id is unique per creative variant.
          // The UI will group them if needed, but the search API returns all variants.

          const nextOffset = offset + limit;
          const nextCursor = hasMore ? nextOffset.toString() : null;

          if (ads.length || filters.source === "competitor" || filters.cursor) payload = {
            ads: adsForClient(ads),
            nextCursor,
            total: defaultFeed ? ads.length : pagedData.length,
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

    if (!payload && isSupabaseConfigured && filters.source !== "competitor" && hasLiveSearchIntent && canUseProvider) {
      const { getToken } = await auth();
      const token = await getToken();

      if (token) {
        const env = getServerEnv();
        const functionUrl = `${env.supabaseUrl}/functions/v1/ads-search`;
        let providerError: unknown = null;

        try {
          const requestKey = `edge:${providerRequestKey}`;
          let pending = inFlight.get(requestKey);
          if (!pending) {
            const edgePayload = { ...filters, requestId };
            pending = fetch(functionUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(edgePayload),
              signal: AbortSignal.timeout(28_000)
            }).then(async (res) => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new ProviderError(errData.code || "UNKNOWN", errData.message || "Edge function failed", res.status);
              }
              return res.json() as Promise<AdSearchResult>;
            }).finally(() => inFlight.delete(requestKey));

            inFlight.set(requestKey, pending);
          }

          const result = await pending;
          const ids = [...new Set(result.ads.map(ad => ad.advertiser?.id).filter((id): id is string => Boolean(id)))];
          const { data: mappings } = ids.length
            ? await catalogClient!.from("ads").select("*").in("advertiser_id", ids).limit(1000)
            : { data: [] };
          const canonical = (mappings || []).map(brandFromRow).filter((b): b is NonNullable<typeof b> => Boolean(b));
          result.ads = ensureWinnerScores(resolveAdIdentities(result.ads, canonical, filters.selectedBrand, filters.brand));

            if (result && result.ads && result.ads.length > 0) {
              // Note: We no longer deduplicate by ad.id blindly here.
              // We rely on canonical_ad_id which already encapsulates unique creatives.
              // Duplicates in result.ads are real variants and should be preserved.
              const dedupMap = new Map<string, NormalizedAd>();
              for (const ad of result.ads) {
                if (!dedupMap.has(ad.id)) {
                  dedupMap.set(ad.id, ad);
                }
              }
              result.ads = Array.from(dedupMap.values());

            const adsToArchive = result.ads;
            // Complete identity persistence before responding so immediate refresh is consistent.
            const persistence = await persistNormalizedAds(adsToArchive);
            if (persistence.error) throw new ProviderError("PROVIDER_UNAVAILABLE", persistence.error, 502);
            after(() => archiveAdsInBackground(adsToArchive));

            // Apply fingerprint dedupe for UI
            const uiDedupMap = new Map<string, NormalizedAd>();
            for (const ad of result.ads) {
              const groupId = ad.fingerprint || ad.id;
              if (!uiDedupMap.has(groupId)) {
                uiDedupMap.set(groupId, ad);
              }
            }
            const uiAds = Array.from(uiDedupMap.values());

            payload = { ...result, ads: adsForClient(uiAds), requestId };
          } else if (result && result.ads && result.ads.length === 0) {
            payload = { ...result, ads: [], requestId };
          }
        } catch (error) {
          console.error(`[AdsSearch][requestId=${requestId}] Edge function error:`, error);
          providerError = error;
        }

        if (!payload) {
          // Local indexed/cached corpus search for keyword capability
          if (providerError) console.info(`[AdsSearch][requestId=${requestId}] Attempting query-aware cache fallback after provider error`);
          else if (capabilityMismatch) console.info(`[AdsSearch][requestId=${requestId}] Using local corpus due to provider capability mismatch`);
          try {
            let query = catalogClient!.from("ads").select("*", { count: "exact" });

            if (filters.brand) {
              query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
            } else if (filters.query) {
              const q = filters.query.trim().replace(/%/g, '\\%');
              query = query.or(`headline.ilike.%${q}%,body.ilike.%${q}%,description.ilike.%${q}%,advertiser_name.ilike.%${q}%`);
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
              const canonical = data.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
              const resolved = ensureWinnerScores(resolveAdIdentities(data.map(dbAdToNormalized).filter(hasRenderableMedia), canonical, filters.selectedBrand, filters.brand));
              const deduplicated = Array.from(new Map(resolved.map(ad => [ad.id, ad])).values());
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
    }

    if (payload) {
      payload.ads = ensureWinnerScores(resolveAdIdentities(payload.ads, [], filters.selectedBrand, filters.brand));
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

      return searchResponse(payload, requestId, startedAt, { headers: { "Cache-Control": "no-store" } });
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


function takeDefaultFeed(rows: Parameters<typeof dbAdToNormalized>[0][], limit: number, filters: AdSearchFilters) {
  const counts = new Map<string, number>();
  return rows
    .map(row => resolveAdIdentities([dbAdToNormalized(row)], brandFromRow(row) ? [brandFromRow(row)!] : [])[0])
    .filter(ad => realAdvertiserName(ad.advertiser?.name, ad.advertiser?.id))
    .filter(hasRenderableMedia)
    .filter(ad => matchesClientFilters(ad, filters))
    .sort(() => Math.random() - 0.5)
    .filter(ad => {
      const key = ad.advertiser?.id || realAdvertiserName(ad.advertiser?.name) || ad.id;
      const count = counts.get(key) || 0;
      if (count >= 5) return false;
      counts.set(key, count + 1);
      return true;
    })
    .slice(0, limit);
}

function hasRenderableMedia(ad: NormalizedAd) {
  const media = resolveAdMedia(ad);
  return Boolean(media.imageUrl || media.videoUrl || media.thumbnailUrl || media.carouselAssets?.length);
}

function matchesClientFilters(ad: NormalizedAd, filters: AdSearchFilters) {
  if (filters.languages?.length && !filters.languages.some(value => ad.delivery.countries.includes(value.toUpperCase()))) return false;
  const haystack = [
    ad.intelligence?.category,
    ad.intelligence?.creativeFormat,
    ad.intelligence?.hookType,
    ad.intelligence?.offerType,
    ...(ad.intelligence?.labels || []),
    ad.copy?.headline,
    ad.copy?.primaryText,
    ad.copy?.description,
  ].filter(Boolean).join(" ").toLowerCase();
  if (filters.niches?.length && !filters.niches.some(value => haystack.includes(value.toLowerCase()))) return false;
  if (filters.contentStyles?.length && !filters.contentStyles.some(value => haystack.includes(value.toLowerCase()))) return false;
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
