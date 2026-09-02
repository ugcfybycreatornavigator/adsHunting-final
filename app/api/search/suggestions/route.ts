import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NICHES, CONTENT_STYLES, LANGUAGES, MARKETS } from "@/lib/taxonomy";
import { getAdProviders } from "@/lib/providers";

// Short-lived memory cache for external provider lookups to prevent rate limit pressure
const externalProviderCache = new Map<string, { timestamp: number; results: SearchSuggestion[] }>();
const CACHE_TTL_MS = 60_000;

export type SearchSuggestion = {
  id: string;
  type: "brand" | "advertiser" | "keyword" | "category" | "recent";
  label: string;
  normalizedLabel: string;
  subtitle?: string;
  imageUrl?: string | null;
  activeAdCount?: number | null;
  totalAdCount?: number | null;
  href?: string;
};

export async function GET(request: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.trim().toLowerCase();
  
  if (query.length < 2) {
    return NextResponse.json({ query: rawQuery, suggestions: [] });
  }
  
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);

  const suggestions: SearchSuggestion[] = [];

  // 1. Static Categories matching
  const staticSources = [
    { type: "category" as const, subtitle: "Niche", data: NICHES },
    { type: "category" as const, subtitle: "Style", data: CONTENT_STYLES },
    { type: "category" as const, subtitle: "Language", data: LANGUAGES },
    { type: "category" as const, subtitle: "Market", data: MARKETS },
  ];

  for (const source of staticSources) {
    for (const item of source.data) {
      if (item.label.toLowerCase().includes(query)) {
        suggestions.push({
          id: `cat_${source.subtitle.toLowerCase()}_${'code' in item ? item.code : item.id}`,
          type: source.type,
          label: item.label,
          normalizedLabel: item.label.toLowerCase(),
          subtitle: source.subtitle,
        });
      }
    }
  }

  // 2. Fetch Brand suggestions from DB
  const supabase = createAdminClient();
  let dbBrands: Record<string, unknown>[] | null = null;
  let dbError = null;
  
  const startTimer = Date.now();
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_search_suggestions', { 
        search_query: query,
        max_limit: limit
      });

    if (rpcError && rpcError.code === '42883') {
      // Fallback if migration not applied
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('ads')
        .select('advertiser_id, advertiser_name, status, advertiser_avatar_url')
        .ilike('advertiser_name', `${query}%`)
        .limit(100);

      if (fallbackError) {
        dbError = fallbackError;
      } else if (fallbackData) {
        const brandMap = new Map();
        for (const ad of fallbackData) {
          if (!brandMap.has(ad.advertiser_name)) {
            brandMap.set(ad.advertiser_name, { 
              id: ad.advertiser_id, 
              label: ad.advertiser_name, 
              activeCount: 0,
              logoUrl: ad.advertiser_avatar_url
            });
          }
          if (ad.status === 'active') {
            brandMap.get(ad.advertiser_name).activeCount++;
          }
        }
        dbBrands = Array.from(brandMap.values())
          .sort((a, b) => b.activeCount - a.activeCount)
          .map(b => ({
            id: b.id,
            label: b.label,
            normalized_label: b.label.toLowerCase(),
            active_ad_count: b.activeCount,
            advertiser_avatar_url: b.logoUrl
          }))
          .slice(0, limit);
      }
    } else if (rpcError) {
      dbError = rpcError;
    } else {
      dbBrands = rpcData;
    }

    if (dbError) {
      console.error("Suggestion fetch DB error:", dbError);
      return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
    }

    if (dbBrands && dbBrands.length > 0) {
      for (const b of dbBrands) {
        suggestions.push({
          id: b.id as string,
          type: "brand",
          label: b.label as string,
          normalizedLabel: b.normalized_label as string,
          subtitle: "Brand",
          activeAdCount: b.active_ad_count as number,
          imageUrl: b.advertiser_avatar_url as string | null,
        });
      }
    } else if (query.length >= 3) {
      // Local miss: Fallback to provider orchestrator to discover brand identity
      const now = Date.now();
      const cacheKey = query;
      let externalBrands: SearchSuggestion[] = [];
      
      const cached = externalProviderCache.get(cacheKey);
      if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        externalBrands = cached.results;
      } else {
        try {
          const providers = getAdProviders({ query });
          // Find first capable provider (searchapi/foreplay)
          const provider = providers.find(p => p.provider.capabilities.keywordSearch || p.provider.capabilities.advertiserSearch);
          
          if (provider) {
             const abortController = new AbortController();
             const timeout = setTimeout(() => abortController.abort(), 400); // 400ms budget
             
             // Cast to any to pass the signal if the provider supports it, or it will just abort at network level if the provider uses a global signal
             const result = await Promise.race([
                provider.provider.searchAds({ query, status: "all" }),
                new Promise<never>((_, reject) => {
                  abortController.signal.addEventListener('abort', () => reject(new Error('Provider autocomplete timeout')));
                })
             ]);
             clearTimeout(timeout);
             
             // Extract unique advertisers
             const brandMap = new Map();
             for (const ad of result.ads) {
               if (ad.advertiser.name && !brandMap.has(ad.advertiser.name.toLowerCase())) {
                 brandMap.set(ad.advertiser.name.toLowerCase(), {
                   id: ad.advertiser.id,
                   label: ad.advertiser.name,
                   logoUrl: ad.advertiser.logoUrl || null,
                   activeCount: 0
                 });
               }
               if (ad.advertiser.name && ad.delivery.status === "active") {
                 brandMap.get(ad.advertiser.name.toLowerCase()).activeCount++;
               }
             }
             
             externalBrands = Array.from(brandMap.values()).map(b => ({
                id: b.id as string,
                type: "brand" as const,
                label: b.label as string,
                normalizedLabel: b.label.toLowerCase(),
                subtitle: "Brand",
                activeAdCount: b.activeCount,
                imageUrl: b.logoUrl as string | null,
             }));
             
             externalProviderCache.set(cacheKey, { timestamp: now, results: externalBrands });
          }
        } catch (err) {
          console.warn(`[Autocomplete] External provider lookup failed/timeout for '${query}'`);
          // Fails safely; we just don't have provider brands
        }
      }
      
      for (const b of externalBrands) {
        suggestions.push(b);
      }
    }
  } catch (error) {
    console.error("Suggestion fetch exception:", error);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }

  const durationMs = Date.now() - startTimer;
  // Use duration logging in console for verification
  if (process.env.NODE_ENV === "development") {
    console.log(`[Autocomplete] '${query}' took ${durationMs}ms`);
  }

  // Deduplicate case-insensitively, prioritizing exact matches
  const dedupedMap = new Map<string, SearchSuggestion>();
  
  for (const s of suggestions) {
    const key = `${s.type}:${s.normalizedLabel}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, s);
    } else {
      // Merge logic if needed, but since we pushed exact static first, keep existing
    }
  }

  const finalSuggestions = Array.from(dedupedMap.values()).sort((a, b) => {
    // Exact match on label
    if (a.normalizedLabel === query && b.normalizedLabel !== query) return -1;
    if (b.normalizedLabel === query && a.normalizedLabel !== query) return 1;
    // Prefix match
    const aStartsWith = a.normalizedLabel.startsWith(query);
    const bStartsWith = b.normalizedLabel.startsWith(query);
    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;
    
    // Sort by count for brands
    if (a.type === 'brand' && b.type === 'brand') {
      return (b.activeAdCount || 0) - (a.activeAdCount || 0);
    }
    
    // Brands before categories
    if (a.type === 'brand' && b.type !== 'brand') return -1;
    if (b.type === 'brand' && a.type !== 'brand') return 1;

    return 0;
  }).slice(0, limit);

  return NextResponse.json({ query: rawQuery, suggestions: finalSuggestions }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
    }
  });
}
