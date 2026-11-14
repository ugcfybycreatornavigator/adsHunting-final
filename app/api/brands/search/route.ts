import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextResponse } from "next/server";
import { getBrands, BrandSummary } from "@/lib/brand-data";
import { requireUser } from "@/lib/auth";
import { getAdProviders } from "@/lib/providers";
import { realAdvertiserName } from "@/lib/advertiser-identity";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  query: z.string().max(200).optional().default("")
});

export async function POST(request: Request) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    const auth = await requireUser();
    if (auth.error || !auth.user) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = await rateLimit(`brand-search:${auth.user.id}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search query." }, { status: 400 });
    }

    const query = parsed.data.query.trim();
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
