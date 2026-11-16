import type { NormalizedAd } from "./types";
import { computeAdFingerprints } from "./fingerprint";
import { normalizeAdDetail } from "./ad-detail-metadata";
import { classifyAdCategory, isValidCuratedCategory } from "./category-classifier";

export function refineAd(ad: Partial<NormalizedAd>): NormalizedAd {
  const now = new Date().toISOString();

  // Defensive fallback for completely malformed records
  const refined: NormalizedAd = {
    id: ad.id || crypto.randomUUID(),
    externalId: ad.externalId || ad.id || null,
    provider: {
      discoveryProvider: ad.provider?.discoveryProvider || "catalog",
      fetchedAt: ad.provider?.fetchedAt || now,
    },
    advertiser: {
      id: ad.advertiser?.id || null,
      name: ad.advertiser?.name || null,
      displayName: ad.advertiser?.name || null,
      normalizedName: ad.advertiser?.normalizedName || null,
      pageUrl: ad.advertiser?.pageUrl || null,
      logoUrl: ad.advertiser?.logoUrl || null,
      domain: ad.advertiser?.domain || null,
      social: ad.advertiser?.social || { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: ad.copy?.primaryText || null,
      headline: ad.copy?.headline || null,
      description: ad.copy?.description || null,
      cta: ad.copy?.cta || null,
    },
    creative: {
      type: ad.creative?.type || "unknown",
      imageUrl: ad.creative?.imageUrl || null,
      videoUrl: ad.creative?.videoUrl || null,
      thumbnailUrl: ad.creative?.thumbnailUrl || null,
      carouselItems: Array.isArray(ad.creative?.carouselItems) ? ad.creative!.carouselItems : [],
    },
    delivery: {
      status: ad.delivery?.status || "unknown",
      startedAt: ad.delivery?.startedAt || null,
      endedAt: ad.delivery?.endedAt || null,
      daysRunning: typeof ad.delivery?.daysRunning === "number" ? ad.delivery.daysRunning : null,
      platforms: Array.isArray(ad.delivery?.platforms) ? ad.delivery!.platforms : [],
      countries: Array.isArray(ad.delivery?.countries) ? ad.delivery!.countries : [],
    },
    destination: {
      url: ad.destination?.url || null,
      resolvedUrl: ad.destination?.resolvedUrl || null,
      domain: ad.destination?.domain || null,
      title: ad.destination?.title || null,
      productName: ad.destination?.productName || null,
    },
    intelligence: (() => {
      const classified = classifyAdCategory({
        advertiserName: ad.advertiser?.name,
        headline: ad.copy?.headline,
        body: ad.copy?.primaryText,
        landingPageUrl: ad.destination?.url,
        existingCategory: ad.intelligence?.category,
      });
      const category = classified.category === "Unknown"
        ? (isValidCuratedCategory(ad.intelligence?.category) ? ad.intelligence!.category : null)
        : classified.category;
      return {
        category,
        nicheId: classified.nicheId !== "unknown" ? classified.nicheId : (ad.intelligence?.nicheId || null),
        categoryProvenance: classified.provenance,
        categoryConfidence: classified.confidence,
        creativeFormat: ad.intelligence?.creativeFormat || null,
        hookType: ad.intelligence?.hookType || null,
        offerType: ad.intelligence?.offerType || null,
        winnerScore: typeof ad.intelligence?.winnerScore === "number" ? ad.intelligence.winnerScore : null,
        labels: category && !ad.intelligence?.labels?.includes(category)
          ? [...(Array.isArray(ad.intelligence?.labels) ? ad.intelligence!.labels : []), category]
          : (Array.isArray(ad.intelligence?.labels) ? ad.intelligence!.labels : []),
      };
    })(),
    enrichment: {
      archiveStatus: ad.enrichment?.archiveStatus || "not_requested",
      status: ad.enrichment?.status || "pending",
      qualityScore: typeof ad.enrichment?.qualityScore === "number" ? ad.enrichment.qualityScore : 0,
      lastEnrichedAt: ad.enrichment?.lastEnrichedAt || null,
    },
    detail: normalizeAdDetail(ad.detail),
    variants: typeof ad.variants === "number" ? ad.variants : 1,
    creativeRepetition: typeof ad.creativeRepetition === "number" ? ad.creativeRepetition : 0,
    brandActiveAds: typeof ad.brandActiveAds === "number" ? ad.brandActiveAds : null,
    rawData: ad.rawData || null,
  };

  const fps = computeAdFingerprints(refined);
  refined.fingerprint = fps.creativeFingerprint;
  refined.id = fps.canonicalAdId;
  
  return refined;
}
