import { realAdvertiserName, resolveAdvertiser } from "../supabase/functions/_shared/ads/advertiser-identity";
import type { AdStatus, MediaType, NormalizedAd } from "@/lib/types";
import { computeAdFingerprints } from "@/lib/fingerprint";

export interface DatabaseAdRow {
  id: string;
  external_ad_id: string;
  canonical_ad_id?: string;
  creative_fingerprint?: string;
  creative_group_id?: string;
  observation_count?: number;
  provider_ad_ids?: string[];
  missing_checks?: number;
  variant_key?: string;
  advertiser_id: string;
  advertiser_name: string;
  advertiser_avatar_url: string | null;
  advertiser_profile_url: string | null;
  body: string | null;
  caption?: string | null;
  headline: string | null;
  description: string | null;
  hashtags?: string[] | null;
  cta: string | null;
  landing_page_url: string | null;
  source_media_url: string | null;
  thumbnail_url: string | null;
  carousel_assets?: string[] | null;
  stored_media_path: string | null;
  archive_status?: "not_requested" | "archived" | "failed" | "unavailable" | null;
  media_type: MediaType;
  status: AdStatus;
  start_date: string | null;
  stop_date: string | null;
  first_seen_at: string;
  last_seen_at: string;
  running_days: number | null;
  country: string | null;
  platforms: string[] | null;
  demographics?: Record<string, Record<string, number>> | null;
  snapshot_url: string | null;
  source: string;
  raw_data: Record<string, unknown> | null;
  refined_data: Record<string, unknown> | null;
  quality_score: number | null;
}

export function dbAdToNormalized(row: DatabaseAdRow): NormalizedAd {
  const derivedRunningDays = row.running_days && row.running_days > 0
    ? Number(row.running_days)
    : row.start_date
      ? Math.max(0, Math.floor(((row.stop_date ? new Date(row.stop_date).getTime() : Date.now()) - new Date(row.start_date).getTime()) / 86_400_000))
      : null;
  if (row.refined_data && Object.keys(row.refined_data).length > 0) {
    const refinedAd = row.refined_data as unknown as NormalizedAd;
    const rowCarouselItems = (row.carousel_assets || []).map((asset) =>
      /\.(?:mp4|webm|mov)(?:$|\?)/i.test(asset) ? { videoUrl: asset } : { imageUrl: asset }
    );
    const refinedCarouselItems = Array.isArray(refinedAd.creative?.carouselItems)
      ? refinedAd.creative.carouselItems
      : [];
    const advertiser = refinedAd.advertiser || { id: row.advertiser_id, name: null, logoUrl: null,
      pageUrl: null, domain: null, normalizedName: null, social: { facebook: null, instagram: null, linkedin: null } };
    return { ...refinedAd, id: row.canonical_ad_id || row.id,
      creative: {
        ...refinedAd.creative,
        type: row.media_type || refinedAd.creative?.type || "unknown",
        imageUrl: row.media_type === "video" ? refinedAd.creative?.imageUrl || null : row.source_media_url || refinedAd.creative?.imageUrl || null,
        videoUrl: row.media_type === "video" ? row.source_media_url || refinedAd.creative?.videoUrl || null : refinedAd.creative?.videoUrl || null,
        thumbnailUrl: row.thumbnail_url || refinedAd.creative?.thumbnailUrl || null,
        carouselItems: rowCarouselItems.length ? rowCarouselItems : refinedCarouselItems,
      },
      advertiser: resolveAdvertiser({ ...advertiser, id: advertiser.id || row.advertiser_id }, undefined, undefined, {
        name: realAdvertiserName(row.advertiser_name, row.advertiser_id),
        logoUrl: row.advertiser_avatar_url, pageUrl: row.advertiser_profile_url,
      }),
      delivery: { ...refinedAd.delivery, daysRunning: derivedRunningDays },
    };
  }

  // Fallback for old records without refined_data
  return {
    id: row.canonical_ad_id || row.id,
    externalId: row.external_ad_id,
    provider: {
      discoveryProvider: row.source as NormalizedAd["provider"]["discoveryProvider"],
      fetchedAt: row.first_seen_at,
    },
    advertiser: {
      id: row.advertiser_id,
      name: realAdvertiserName(row.advertiser_name, row.advertiser_id),
      normalizedName: null,
      pageUrl: row.advertiser_profile_url,
      logoUrl: row.advertiser_avatar_url,
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: row.body,
      headline: row.headline,
      description: row.description,
      cta: row.cta,
    },
    creative: {
      type: row.media_type,
      imageUrl: row.media_type === "video" ? null : row.source_media_url,
      videoUrl: row.media_type === "video" ? row.source_media_url : null,
      thumbnailUrl: row.thumbnail_url,
      carouselItems: (row.carousel_assets || []).map((asset) =>
        /\.(?:mp4|webm|mov)(?:$|\?)/i.test(asset) ? { videoUrl: asset } : { imageUrl: asset }
      ),
    },
    delivery: {
      status: row.status,
      startedAt: row.start_date,
      endedAt: row.stop_date,
      daysRunning: derivedRunningDays,
      platforms: row.platforms ?? [],
      countries: row.country ? [row.country] : [],
    },
    destination: {
      url: row.landing_page_url,
      resolvedUrl: null,
      domain: null,
      title: null,
      productName: null,
    },
    intelligence: {
      category: null,
      creativeFormat: null,
      hookType: null,
      offerType: null,
      winnerScore: row.quality_score != null ? Number(row.quality_score) : 0,
      labels: [],
    },
    enrichment: {
      archiveStatus: (row.archive_status as NormalizedAd["enrichment"]["archiveStatus"]) || "not_requested",
      status: "pending",
      qualityScore: Number(row.quality_score) || 0,
      lastEnrichedAt: null,
    },
    variants: 1,
    creativeRepetition: 0,
    brandActiveAds: null,
    rawData: row.raw_data,
  };
}

export function normalizedToDb(ad: NormalizedAd): Omit<DatabaseAdRow, "created_at" | "updated_at" | "id"> {
  const fingerprints = computeAdFingerprints(ad);
  return {
    external_ad_id: ad.externalId || ad.id,
    canonical_ad_id: ad.id,
    creative_fingerprint: ad.fingerprint || fingerprints.creativeFingerprint,
    creative_group_id: fingerprints.creativeGroupId,
    observation_count: 1,
    provider_ad_ids: [ad.externalId || ad.id],
    advertiser_id: ad.advertiser.id || "",
    advertiser_name: realAdvertiserName(ad.advertiser.name, ad.advertiser.id) || "",
    advertiser_avatar_url: ad.advertiser.logoUrl,
    advertiser_profile_url: ad.advertiser.pageUrl,
    body: ad.copy.primaryText,
    caption: ad.copy.description,
    headline: ad.copy.headline,
    description: ad.copy.description,
    hashtags: [],
    cta: ad.copy.cta,
    landing_page_url: ad.destination.url,
    source_media_url: ad.creative.videoUrl || ad.creative.imageUrl,
    thumbnail_url: ad.creative.thumbnailUrl,
    carousel_assets: ad.creative.carouselItems?.map(c => c.videoUrl || c.imageUrl).filter(Boolean) as string[] || [],
    media_type: ad.creative.type,
    status: ad.delivery.status,
    start_date: ad.delivery.startedAt,
    stop_date: ad.delivery.endedAt,
    first_seen_at: ad.provider.fetchedAt,
    last_seen_at: new Date().toISOString(),
    stored_media_path: null,
    archive_status: "not_requested",
    missing_checks: 0,
    running_days: ad.delivery.daysRunning,
    country: ad.delivery.countries[0] || null,
    platforms: ad.delivery.platforms.length > 0 ? ad.delivery.platforms : null,
    demographics: null,
    snapshot_url: null,
    source: ad.provider.discoveryProvider === "meta_official" ? "meta" : ad.provider.discoveryProvider as string,
    variant_key: `${ad.advertiser.name}:${ad.copy.headline || ""}:${ad.creative.type}`.slice(0, 500),
    raw_data: ad.rawData ?? {},
    refined_data: ad,
    quality_score: ad.intelligence.winnerScore ?? 0,
  } as unknown as Omit<DatabaseAdRow, "created_at" | "updated_at">;
}
