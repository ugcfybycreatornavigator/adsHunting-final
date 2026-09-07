import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextResponse } from "next/server";
import { getBrands, BrandSummary } from "@/lib/brand-data";
import { requireUser } from "@/lib/auth";
import { getAdProviders } from "@/lib/providers";
import { realAdvertiserName } from "@/lib/advertiser-identity";

export async function POST(request: Request) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const { query } = await request.json();
    let externalCandidates: BrandSummary[] = [];

    // If there is a query, attempt to find live candidates from SearchAPI
    // This solves the problem where a user searches for an advertiser that has active ads
    // but isn't fully propagated in the catalog yet.
    if (query && query.trim()) {
      try {
        const advertiserMap = new Map<string, BrandSummary>();
        for (const { provider } of getAdProviders({ query, status: "all" })) {
          const result = await provider.searchAds({ query, status: "all" });
          for (const ad of result.ads.slice(0, 10)) {
            const advId = ad.advertiser?.id;
            const advertiserName = realAdvertiserName(ad.advertiser?.name, advId);
            if (!advId || !advertiserName) continue;
            if (!advertiserMap.has(advId)) {
              advertiserMap.set(advId, {
                id: advId,
                name: advertiserName,
                avatar: ad.advertiser?.logoUrl || null,
                platforms: ad.delivery?.platforms || [],
                totalUnique: null,
                activeUnique: null,
                previewMedia: ad.creative?.videoUrl ? [ad.creative.videoUrl] : ad.creative?.imageUrl ? [ad.creative.imageUrl] : [],
                previewThumbs: ad.creative?.thumbnailUrl ? [ad.creative.thumbnailUrl] : []
              });
            }
          }
          if (advertiserMap.size) break;
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
