import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextResponse } from "next/server";
import { getBrands, BrandSummary } from "@/lib/brand-data";
import { requireUser } from "@/lib/auth";
import { getServerEnv, isSpyglassConfigured } from "@/lib/env/server";
import { SpyglassProvider } from "@/lib/providers/spyglass";

export async function POST(request: Request) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    await requireUser();

    const { query } = await request.json();
    let externalCandidates: BrandSummary[] = [];

    if (query && query.trim() && isSpyglassConfigured) {
      try {
        const env = getServerEnv();
        const provider = new SpyglassProvider(env.spyglassApiKey, env.spyglassEnabled);
        const result = await provider.searchAds({ query, status: "all" });

        const advertiserMap = new Map<string, BrandSummary>();
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
              totalUnique: null,
              activeUnique: null,
              previewMedia: ad.creative?.videoUrl ? [ad.creative.videoUrl] : ad.creative?.imageUrl ? [ad.creative.imageUrl] : [],
              previewThumbs: ad.creative?.thumbnailUrl ? [ad.creative.thumbnailUrl] : []
            });
          }
        }
        externalCandidates = Array.from(advertiserMap.values());
      } catch (err) {
        console.error("Failed to fetch live brand candidates from Spyglass:", err);
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
