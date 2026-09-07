import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NICHES, CONTENT_STYLES, LANGUAGES, MARKETS } from "@/lib/taxonomy";
import type { BrandIdentity } from "@/lib/types";
import { brandFromRow, identityProvider, realAdvertiserName } from "@/lib/advertiser-identity";
import { getAdProviders } from "@/lib/providers";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { requireUser } from "@/lib/auth";

// Short-lived memory cache for external provider lookups to prevent rate limit pressure
const externalProviderCache = new Map<string, { timestamp: number; results: SearchSuggestion[] }>();
const CACHE_TTL_MS = 60_000;

export type SearchSuggestion = {
  id: string;
  brand?: BrandIdentity;
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
    }

    if (dbBrands?.length) {
      const { data: identityRows } = await supabase.from("ads")
        .select("advertiser_id,advertiser_name,advertiser_avatar_url,advertiser_profile_url,source,raw_data,refined_data")
        .in("advertiser_id", dbBrands.map(b => String(b.id)))
        .order("last_seen_at", { ascending: false }).limit(1000);
      const brands = new Map<string, BrandIdentity>();
      for (const row of identityRows || []) {
        const brand = brandFromRow(row);
        if (brand && !brands.has(brand.id)) brands.set(brand.id, brand);
      }
      for (const b of dbBrands) {
        const brand = brands.get(String(b.id));
        if (!brand) continue;
        suggestions.push({ id: brand.id, type: "brand", label: brand.name,
          normalizedLabel: brand.name.toLowerCase(), subtitle: brand.domain || "Brand",
          activeAdCount: b.active_ad_count as number, imageUrl: brand.logoUrl, brand });
      }
    }

    // Identity lookup is DB/cache first, then the configured provider chain.
    if (!suggestions.some(s => s.type === "brand") && query.length >= 3) {
      const cached = externalProviderCache.get(query);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) suggestions.push(...cached.results);
      else {
        try {
          const providers = getAdProviders({ query });
          for (const { provider, name: providerName } of providers) {
            const providerStartedAt = Date.now();
            try {
              const result = await provider.searchAds({ query, status: "all" });
            const brands = new Map<string, SearchSuggestion>();
            for (const ad of result.ads) {
              const name = realAdvertiserName(ad.advertiser.name, ad.advertiser.id);
              const provider = identityProvider(ad.provider.discoveryProvider);
              if (!name || !ad.advertiser.id || !provider) continue;
              const brand: BrandIdentity = { id: ad.advertiser.id, name, provider,
                providerAdvertiserId: ad.advertiser.id, logoUrl: ad.advertiser.logoUrl,
                profileUrl: ad.advertiser.pageUrl, domain: ad.advertiser.domain };
              brands.set(brand.id, { id: brand.id, type: "brand", label: name,
                normalizedLabel: name.toLowerCase(), subtitle: brand.domain || "Brand",
                imageUrl: brand.logoUrl, brand });
            }
            const results = [...brands.values()];
              console.info(JSON.stringify({ provider: providerName, operation: "searchBrands", status: "success",
                duration: Date.now() - providerStartedAt, resultCount: results.length, errorCode: null,
                fallbackUsed: providers[0]?.name !== providerName }));
              if (results.length) {
                externalProviderCache.set(query, { timestamp: Date.now(), results });
                if (externalProviderCache.size > 200) externalProviderCache.delete(externalProviderCache.keys().next().value!);
                suggestions.push(...results);
                break;
              }
            } catch (error) {
              console.warn(JSON.stringify({ provider: providerName, operation: "searchBrands", status: "failure",
                duration: Date.now() - providerStartedAt, resultCount: 0,
                errorCode: error instanceof Error ? error.name : "PROVIDER_FAILURE", fallbackUsed: true }));
            }
          }
        } catch { /* Keep the DB/category results if Meta is unavailable. */ }
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
    if (!realAdvertiserName(s.label, s.id)) continue;
    const key = `${s.type}:${s.brand?.provider || ""}:${s.id}`;
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
      "Cache-Control": "private, max-age=60"
    }
  });
}
