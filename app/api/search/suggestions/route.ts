import { NextRequest, NextResponse } from "next/server";
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
  // const accessError = await requirePaidWorkspaceAccess();
  // if (accessError) return accessError;

  // const auth = await requireUser();
  // if (auth.error) return auth.error;

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
    } 
    
    if (query.length >= 3) {
      // Fetch provider orchestrator to discover freshest brand identity and logos
      const now = Date.now();
      const cacheKey = query;
      let externalBrands: SearchSuggestion[] = [];
      
      const cached = externalProviderCache.get(cacheKey);
      
      let dbCacheData: SearchSuggestion | null = null;
      try {
        const { data: resolutionData } = await supabase
          .from("search_resolution_cache")
          .select("*")
          .eq("query_text", query)
          .single();
          
        if (resolutionData) {
          dbCacheData = {
            id: resolutionData.provider_brand_id,
            type: "brand",
            label: resolutionData.canonical_name,
            normalizedLabel: resolutionData.canonical_name.toLowerCase(),
            subtitle: "Brand",
            imageUrl: resolutionData.logo_url
          };
        }
      } catch (e) {
        // Table may not exist yet or no rows
      }

      if (dbCacheData) {
        externalBrands = [dbCacheData];
      } else if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        externalBrands = cached.results;
      } else {
        try {
          const providers = getAdProviders({});
          console.log("[DEBUG] Autocomplete providers available:", providers.map(p => p.name));
          // Find first capable provider (searchapi/foreplay/spyglass)
          const provider = providers.find(p => p.provider.capabilities.brandSearch || p.provider.capabilities.keywordSearch || p.provider.capabilities.advertiserSearch);
          
          if (provider) {
             const abortController = new AbortController();
             const timeout = setTimeout(() => abortController.abort(), 4000); // Allow sufficient time for Spyglass API response
             
             try {
               if (provider.provider.capabilities.brandSearch && provider.provider.searchBrands) {
                 let result = await Promise.race([
                    provider.provider.searchBrands(query),
                    new Promise<never>((_, reject) => {
                      abortController.signal.addEventListener('abort', () => reject(new Error('Provider autocomplete timeout')));
                    })
                 ]) as { id: string; name: string; logoUrl?: string | null }[];
                 
                 // CASE B Controlled Recovery
                 const normalize = (str: string) => (str || "").toLowerCase().trim().replace(/[\W_]+/g, "");
                 
                 const getConfidence = (q: string, candidate: string) => {
                   const nq = normalize(q);
                   const nc = normalize(candidate);
                   if (nq === nc) return 100;
                   if (nc.startsWith(nq)) return 90;
                   if (nq.startsWith(nc)) return 80;
                   
                   const qRaw = (q || "").toLowerCase().trim();
                   const cRaw = (candidate || "").toLowerCase().trim();
                   if (cRaw.includes(qRaw)) return 70;
                   
                   return 0;
                 };

                 const hasStrongSmartMatch = result.some(b => getConfidence(query, b.name) >= 80);
                 
                 if (!hasStrongSmartMatch && dbBrands && dbBrands.length > 0 && query.length >= 3) {
                    let bestCandidate: string | null = null;
                    let bestScore = 0;
                    
                    for (const dbb of dbBrands) {
                      const score = getConfidence(query, dbb.label as string);
                      if (score > bestScore && score >= 80) {
                         bestScore = score;
                         bestCandidate = dbb.label as string;
                      }
                    }
                    
                    if (bestCandidate && provider.provider.searchBrandsByName) {
                       console.log(`[Autocomplete] Targeted recovery for canonical brand: '${bestCandidate}'`);
                       try {
                         const recoveryResult = await provider.provider.searchBrandsByName([bestCandidate]);
                         if (recoveryResult && recoveryResult.length > 0) {
                           // Ensure targeted result is at the top, without duplicates
                           const existingIds = new Set(result.map(r => r.id));
                           const newResults = recoveryResult.filter(r => !existingIds.has(r.id));
                           result = [...newResults, ...result];
                         }
                       } catch (e) {
                         console.warn(`[Autocomplete] Targeted recovery failed for '${bestCandidate}'`, e);
                       }
                    }
                 }
                 
                 externalBrands = result.map((b) => ({
                    id: String(b.id),
                    type: "brand" as const,
                    label: String(b.name),
                    normalizedLabel: String(b.name).toLowerCase(),
                    subtitle: "Brand",
                    activeAdCount: undefined,
                    imageUrl: (b.logoUrl as string) || null,
                 }));
               } else {
                 const result = await Promise.race([
                    provider.provider.searchAds({ query, status: "all" }),
                    new Promise<never>((_, reject) => {
                      abortController.signal.addEventListener('abort', () => reject(new Error('Provider autocomplete timeout')));
                    })
                 ]);
                 
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
                 
                 externalBrands = Array.from(brandMap.values()).map((b: { id: string; label: string; logoUrl: string | null; activeCount: number }) => ({
                    id: String(b.id),
                    type: "brand" as const,
                    label: String(b.label),
                    normalizedLabel: String(b.label).toLowerCase(),
                    subtitle: "Brand",
                    activeAdCount: b.activeCount,
                    imageUrl: b.logoUrl,
                 }));
               }
               
               // Persist to search resolution cache for faster repeat searches
               if (externalBrands.length > 0) {
                 try {
                   for (const eb of externalBrands) {
                      await supabase.from("search_resolution_cache").upsert({
                         query_text: query,
                         provider_brand_id: eb.id,
                         canonical_name: eb.label,
                         logo_url: eb.imageUrl || null,
                         last_resolved_at: new Date().toISOString()
                      }, { onConflict: "query_text" });
                      break; // Just cache the top one
                   }
                 } catch (e) {
                   console.warn("[Autocomplete] Cache persistence failed (table might not exist yet):", e);
                 }
               }
               
               externalProviderCache.set(cacheKey, { timestamp: now, results: externalBrands });
             } finally {
               clearTimeout(timeout);
             }
          }
        } catch (err: unknown) {
          console.warn(`[Autocomplete] External provider lookup failed/timeout for '${query}':`, err instanceof Error ? err.message : err);
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
    const cleanImageUrl = typeof s.imageUrl === "string" && s.imageUrl.trim() !== "" && s.imageUrl !== "null" ? s.imageUrl : null;
    
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, { ...s, imageUrl: cleanImageUrl });
    } else {
      const existing = dedupedMap.get(key)!;
      // If the incoming suggestion is from external provider, we want to prioritize its ID and logo
      // We know it's external if it doesn't have an activeAdCount (or it comes after dbBrands)
      // Since externalBrands are pushed after dbBrands, the later entries are external.
      
      const incomingLogo = cleanImageUrl;
      
      // Update the entry to use the external provider's identity
      existing.id = s.id;
      existing.label = s.label;
      if (incomingLogo) {
        existing.imageUrl = incomingLogo;
      }
      
      // Preserve DB active count
      if (s.activeAdCount != null) {
        existing.activeAdCount = Math.max(existing.activeAdCount || 0, s.activeAdCount);
      }
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
