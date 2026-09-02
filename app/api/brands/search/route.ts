import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextResponse } from "next/server";
import { getBrands, BrandSummary } from "@/lib/brand-data";
import { requireUser } from "@/lib/auth";
import { getServerEnv, isSearchConfigured } from "@/lib/env/server";
import { SearchApiProvider } from "@/lib/providers/searchapi";

export async function POST(request: Request) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    await requireUser();

    const { query } = await request.json();
    let externalCandidates: BrandSummary[] = [];

    // If there is a query, attempt to find live candidates from SearchAPI
    // This solves the problem where a user searches for an advertiser that has active ads
    // but isn't fully propagated in the catalog yet.
    if (query && query.trim() && isSearchConfigured) {
      try {
        const searchApi = new SearchApiProvider(getServerEnv().searchApiKeys);
        // Only fetch a small number of ads to extract brand information efficiently
        const result = await searchApi.searchAds({ query, status: "all" });
        
        // Extract distinct advertisers
        const advertiserMap = new Map<string, BrandSummary>();
        
        // Limit to 5 results to prevent massive loops since we only need a few brand candidates
        const adsToProcess = result.ads.slice(0, 5);
        
        for (const ad of adsToProcess) {
          const advId = ad.advertiser?.id;
          if (!advId) continue;
          
          if (!advertiserMap.has(advId)) {
            advertiserMap.set(advId, {
              id: advId,
              name: ad.advertiser?.name || "Unknown",
              avatar: ad.advertiser?.logoUrl || null,
              platforms: ad.delivery?.platforms || [],
              totalUnique: null, // To be filled by getBrandStats if needed
              activeUnique: null,
              previewMedia: ad.creative?.videoUrl ? [ad.creative.videoUrl] : ad.creative?.imageUrl ? [ad.creative.imageUrl] : [],
              previewThumbs: ad.creative?.thumbnailUrl ? [ad.creative.thumbnailUrl] : []
            });
          }
        }
        externalCandidates = Array.from(advertiserMap.values());
      } catch (err) {
        console.error("Failed to fetch live brand candidates from SearchAPI:", err);
      }
    }

    const brands = await getBrands(query, externalCandidates);

    return NextResponse.json({ brands });
  } catch (error) {
    console.error("Brands search error:", error);
    return NextResponse.json(
      { error: "Failed to search brands" },
      { status: 500 }
    );
  }
}
