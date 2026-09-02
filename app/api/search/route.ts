import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { dbAdToNormalized } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";
import { ProviderError } from "@/lib/providers/errors";
import { adsForClient, persistNormalizedAds, archiveAdsInBackground } from "@/lib/ads-persistence";
import { isPreviewMode } from "@/lib/preview";
import type { AdSearchResult, NormalizedAd, SearchIntent } from "@/lib/types";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";
import { auth } from "@clerk/nextjs/server";
import { getServerEnv } from "@/lib/env/server";

const schema = z.object({
  query: z.string().trim().max(160).optional(),
  brand: z.string().max(80).optional(),
  platforms: z.array(z.enum(["facebook", "instagram", "messenger", "audience_network", "threads"])).max(5).optional(),
  sort: z.string().max(32).optional(),
  cursor: z.string().max(16_000).optional(),
  cta: z.string().max(40).optional(),

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

type CacheEntry = { expires: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AdSearchResult>>();

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  let catalogClient: Awaited<ReturnType<typeof requireUser>>["supabase"] = null;
  const authRes = await requireUser();
  if (authRes.error) return authRes.error;
  catalogClient = authRes.supabase;

  const balance = await getWorkspaceCreditBalance(authRes.user.id);
  if (balance && balance.creditsRemaining <= 0) {
    return NextResponse.json(
      { error: "INSUFFICIENT_CREDITS", reason: "out_of_credits", creditsRemaining: 0, code: "INSUFFICIENT_CREDITS" },
      { status: 402 }
    );
  }

  if (isSupabaseConfigured && !isPreviewMode) {
    // Already authenticated above
  } else if (isSupabaseConfigured && isPreviewMode) {
    // Already authenticated above
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const limit = rateLimit(`search:${ip}`, 40);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const cleanBody = Object.fromEntries(
    Object.entries(rawBody).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
    )
  );

  const parsed = schema.safeParse(cleanBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search filters.", code: "INVALID_FILTERS", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const filters = normalizeDiscoverFilters(parsed.data);
  
  let resolvedIntent: SearchIntent | undefined = undefined;

  if (filters.brand) {
    resolvedIntent = { type: "advertiser", advertiserId: filters.brand, advertiserName: filters.query || "" };
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
  
  const key = JSON.stringify(normalizedFilters);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.payload, { headers: { "X-Cache": "HIT" } });
  }

  try {
    let payload: AdSearchResult | null = null;

    // 1. Check Supabase preload/cache first if query is empty or requesting discovery feed
    if (isSupabaseConfigured && (!filters.query || !filters.query.trim()) && !filters.brand) {
      try {
        let query = catalogClient!.from("ads").select("*", { count: "exact" });
        
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
        
        // Fetch a large pool to allow in-memory diversity ranking before pagination
        query = query.limit(1000);

        // Apply sort
        if (filters.sort === "newest") {
          query = query.order("start_date", { ascending: false, nullsFirst: false });
        } else if (filters.sort === "oldest") {
          query = query.order("start_date", { ascending: true, nullsFirst: false });
        } else if (filters.sort === "longest") {
          query = query.order("running_days", { ascending: false, nullsFirst: false });
        } else {
          query = query.order("last_seen_at", { ascending: false });
        }

        const { data, error } = await query;

        if (!error && data) {
          const ads = data.map(dbAdToNormalized);
          let ranked = ads;
          const hasActiveFilters = Object.keys(filters).some(k => 
            !['cursor', 'sort', 'query'].includes(k) && 
            filters[k as keyof typeof filters] !== undefined && 
            (Array.isArray(filters[k as keyof typeof filters]) ? (filters[k as keyof typeof filters] as unknown[]).length > 0 : true)
          );
          
          if (!filters.sort || filters.sort === "relevant") {
            ranked = rankDiscoveryFeed(ads, !hasActiveFilters && !filters.query);
          } else if (filters.sort === "newest") {
            ranked.sort((a, b) => new Date(b.delivery.startedAt || 0).getTime() - new Date(a.delivery.startedAt || 0).getTime());
          } else if (filters.sort === "oldest") {
            ranked.sort((a, b) => new Date(a.delivery.startedAt || 0).getTime() - new Date(b.delivery.startedAt || 0).getTime());
          } else if (filters.sort === "longest") {
            ranked.sort((a, b) => (b.delivery.daysRunning || 0) - (a.delivery.daysRunning || 0));
          } else if (filters.sort === "variations") {
            ranked.sort((a, b) => (b.variants ?? 0) - (a.variants ?? 0));
          }
          
          // Deduplicate into variant groups (pick representative) for UI feed
          const variantGroups = new Map<string, NormalizedAd>();
          for (const ad of ranked) {
            const groupId = ad.fingerprint || ad.id;
            if (!variantGroups.has(groupId)) {
              variantGroups.set(groupId, ad);
            } else {
              // Track variants count on the representative (for UI display)
              const rep = variantGroups.get(groupId)!;
              rep.variants = (rep.variants || 1) + 1; 
            }
          }
          
          const deduplicatedRanked = Array.from(variantGroups.values());
          
          // Now apply pagination
          const limit = 25;
          const offset = filters.cursor ? parseInt(filters.cursor, 10) : 0;
          const paged = deduplicatedRanked.slice(offset, offset + limit);
          
          const nextOffset = offset + limit;
          const nextCursor = nextOffset < deduplicatedRanked.length ? nextOffset.toString() : null;
          
          payload = { 
            ads: adsForClient(paged), 
            nextCursor, 
            total: deduplicatedRanked.length, 
            source: "catalog" 
          };
        }
      } catch (err) {
        console.error("[DiscoverAds] Supabase error:", err);
      }
    }

    // 2. Call provider if not satisfied by preloaded cache (e.g. we have a search query)
    if (!payload && isSupabaseConfigured) {
      const { getToken } = await auth();
      const token = await getToken();
      
      if (token) {
        const env = getServerEnv();
        const functionUrl = `${env.supabaseUrl}/functions/v1/ads-search`;
        let providerError: unknown = null;
        
        try {
          const requestKey = `edge:${key}`;
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
              signal: AbortSignal.timeout(12_000)
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
          
          if (result && result.ads && result.ads.length > 0) {
            // Deduplicate provider results canonically by ad.id before persistence
            const dedupMap = new Map<string, NormalizedAd>();
            for (const ad of result.ads) {
              if (!dedupMap.has(ad.id)) {
                dedupMap.set(ad.id, ad);
              }
            }
            result.ads = Array.from(dedupMap.values());
            
            const adsToArchive = result.ads;
            after(() => {
              persistNormalizedAds(adsToArchive)
                .then(() => archiveAdsInBackground(adsToArchive))
                .catch(console.error);
            });

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
          // Fallback to Supabase stored ads on total provider failure (query-aware)
          console.info(`[AdsSearch][requestId=${requestId}] Attempting query-aware cache fallback`);
          try {
            let query = catalogClient!.from("ads").select("*", { count: "exact" });
            
            if (filters.brand) {
              query = query.eq("advertiser_id", filters.brand);
            } else if (filters.query) {
              query = query.ilike("headline", `%${filters.query}%`);
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
              const deduplicated = Array.from(new Map(data.map(dbAdToNormalized).map(ad => [ad.id, ad])).values());
                payload = { 
                  ads: adsForClient(deduplicated), 
                  nextCursor: data.length === 25 ? (offset + 25).toString() : null, 
                  total: data.length, 
                  source: "cache",
                  stale: true,
                  degraded: true,
                  requestId
                } as AdSearchResult & { stale: boolean; degraded: boolean; requestId: string };
              } else {
                // Return an empty success array if cache has no results either, rather than failing the whole UI
                payload = {
                  ads: [],
                  nextCursor: null,
                  total: 0,
                  source: "cache",
                  stale: true,
                  degraded: true,
                  requestId
                } as AdSearchResult & { stale: boolean; degraded: boolean; requestId: string };
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
      if (payload.ads.length > 0) {
        cache.set(key, { expires: Date.now() + 5 * 60_000, payload });
      }
      payload.resolvedIntent = resolvedIntent;
      payload.requestId = requestId;
      return NextResponse.json(payload);
    }

    cache.set(key, { expires: Date.now() + 5 * 60_000, payload });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message, requestId, retryable: error.status >= 500 || error.status === 429 || error.status === 408 }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable.", requestId, retryable: true },
      { status: 502 }
    );
  }
}


function rankDiscoveryFeed(ads: NormalizedAd[], applyDiversityLimit: boolean) {
  const ranked = [...ads].sort((a, b) => {
    // Relevance score proxies
    let aScore = (a.intelligence.winnerScore ?? 0) + (a.delivery.status === "active" ? 10 : 0) + Math.min(a.delivery.daysRunning || 0, 120) / 6 + Math.min(a.variants ?? 0, 10) * 2;
    let bScore = (b.intelligence.winnerScore ?? 0) + (b.delivery.status === "active" ? 10 : 0) + Math.min(b.delivery.daysRunning || 0, 120) / 6 + Math.min(b.variants ?? 0, 10) * 2;
    
    if (applyDiversityLimit) {
      if (a.advertiser?.name?.toLowerCase().includes("foxtale")) aScore += 1000;
      if (b.advertiser?.name?.toLowerCase().includes("foxtale")) bScore += 1000;
    }

    if (bScore !== aScore) return bScore - aScore;
    return a.id.localeCompare(b.id);
  });
  
  if (!applyDiversityLimit) return ranked;

  const advertiserCounts = new Map<string, number>();
  const seenIdentities = new Set<string>();

  return ranked.filter((ad) => {
    const advName = ad.advertiser?.name?.trim() || "";
    const advLower = advName.toLowerCase();
    
    // 1. Remove Frido from default preview
    if (advLower === "frido" || advLower === "frido india") {
      return false;
    }

    // 4. Safe deduplication ONLY for default preview
    const providerId = ad.externalId || ad.id;
    const mediaUrl = ad.creative?.videoUrl || ad.creative?.imageUrl || ad.creative?.thumbnailUrl || "";
    const mediaIdentity = mediaUrl ? `${advLower}::${mediaUrl}` : null;
    const fingerprint = ad.fingerprint;

    if (seenIdentities.has(providerId)) return false;
    if (mediaIdentity && seenIdentities.has(mediaIdentity)) return false;
    if (fingerprint && seenIdentities.has(fingerprint)) return false;

    // Mark as seen
    seenIdentities.add(providerId);
    if (mediaIdentity) seenIdentities.add(mediaIdentity);
    if (fingerprint) seenIdentities.add(fingerprint);

    // 3. Make diverse by limiting to 2 per brand
    const key = ad.advertiser?.id ?? ad.id;
    const currentCount = advertiserCounts.get(key) || 0;
    
    if (currentCount >= 2) return false;
    
    advertiserCounts.set(key, currentCount + 1);
    return true;
  });
}
