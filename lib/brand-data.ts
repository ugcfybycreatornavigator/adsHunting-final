import { isSupabaseConfigured } from "@/lib/env";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdProviders } from "@/lib/providers";
import { persistNormalizedAds } from "@/lib/ads-persistence";
import { brandFromRow, realAdvertiserName, resolveAdIdentities } from "@/lib/advertiser-identity";
import type { AdSearchFilters, BrandIdentity } from "@/lib/types";
import { dbAdToNormalized } from "@/lib/catalog";
import { resolveAdMedia } from "@/lib/media";
import { signArchivedMediaUrls } from "@/lib/media-access";

export type CreativePreview = { id: string; url: string; type: string };

export type CompetitorIntelligence = {
  advertiserId: string;
  brandName: string;
  logoUrl: string | null;
  platforms: string[];
  category: string | null;
  activeAds: number;
  uniqueAds: number;
  totalAds: number;
  newAdsThisWeek: number;
  stoppedAdsThisWeek: number;
  longestRunningDays: number | null;
  averageRunningDays: number | null;
  latestCreatives: CreativePreview[];
  trackedSince: string | null;
  lastActivityAt: string | null;
  firstSeenAt: string | null;
  lastSyncedAt: string | null;

  // Sync & tracking state
  syncStatus: string | null; // idle | syncing | success | error
  syncError: string | null;
  competitorStatus: string | null; // tracking | paused | error
  adsCount: number; // -1 = never synced, 0 = confirmed zero, >0 = real count

  // Analytics properties
  mediaDistribution: Record<string, number>;
  ctaDistribution: Record<string, number>;
};

export type TrackedRecord = {
  advertiser_id: string;
  advertiser_name?: string;
  advertiser_avatar_url?: string | null;
  created_at: string;
  sync_status?: string;
  sync_error?: string | null;
  first_sync_completed_at?: string | null;
  ads_count?: number;
  last_synced_at?: string | null;
  status?: string; // tracking | paused | error
};

type BulkAdRow = {
  id?: string;
  external_ad_id?: string;
  advertiser_id: string;
  advertiser_name: string;
  advertiser_avatar_url: string | null;
  status: string;
  running_days: number | null;
  start_date: string | null;
  end_date: string | null;
  media_type: string;
  cta?: string | null;
  platforms: string[] | null;
  canonical_ad_id: string;
  source_media_url: string | null;
  thumbnail_url: string | null;
  raw_data?: Record<string, unknown> | null;
  refined_data?: Record<string, unknown> | null;
  quality_score?: number | null;
  first_seen_at?: string;
  last_seen_at?: string;
  stop_date?: string | null;
  advertiser_profile_url?: string | null;
  landing_page_url?: string | null;
  body?: string | null;
  headline?: string | null;
  description?: string | null;
  country?: string | null;
  stored_media_path?: string | null;
  snapshot_url?: string | null;
  source?: string;
};

type IdentityRecord = Partial<TrackedRecord> & { sync_status?: string; ads_count?: number };

/**
 * Triggers an immediate API sync for the given competitor's ads and saves them to the DB.
 * Returns the number of ads persisted, or throws on failure.
 */
export async function syncCompetitorAds(advertiserId: string): Promise<number> {
  const logPrefix = `[CompetitorSync][${advertiserId}]`;
  const startMs = Date.now();
  try {
    const env = getServerEnv();
    if (!env.supabaseUrl) {
      console.warn(`${logPrefix} Supabase not configured`);
      return -1;
    }
    
    const supabase = createAdminClient();
    const brandContext = await loadCompetitorBrandIdentity(supabase, advertiserId);
    const filters: AdSearchFilters = { brand: advertiserId, selectedBrand: brandContext, statuses: ["active", "inactive"] };
    const { getAdProviders } = await import("@/lib/providers/index");
    const providers = getAdProviders(filters);
    if (providers.length === 0) {
      console.warn(`${logPrefix} No providers configured`);
      return -1;
    }

    let ads: import("@/lib/types").NormalizedAd[] = [];
    let lastProviderError: unknown = null;
    let providerResponded = false;
    for (const { provider, name } of providers) {
      const providerStartedAt = Date.now();
      try {
        const result = await provider.searchAds(filters);
        providerResponded = true;
        ads = resolveAdIdentities(result.ads, brandContext ? [brandContext] : [], brandContext, advertiserId);
        console.info(JSON.stringify({ provider: name, operation: "syncCompetitorAds", status: "success",
          duration: Date.now() - providerStartedAt, resultCount: ads.length, errorCode: null,
          fallbackUsed: name !== providers[0].name }));
        if (ads.length) break;
      } catch (error) {
        lastProviderError = error;
        console.warn(JSON.stringify({ provider: name, operation: "syncCompetitorAds", status: "failure",
          duration: Date.now() - providerStartedAt, resultCount: 0,
          errorCode: error instanceof Error ? error.name : "PROVIDER_FAILURE", fallbackUsed: true }));
      }
    }

    if (ads.length === 0) {
      if (lastProviderError && !providerResponded) throw lastProviderError;
      console.info(`${logPrefix} Configured providers returned 0 ads`);
      return 0;
    }

    // Deduplicate exact variants by canonical ad.id before persisting
    // Note: ad.id is now a unique composite of (providerAdId + fingerprint), 
    // ensuring we don't accidentally discard valid distinct variants.
    const dedupMap = new Map<string, import("@/lib/types").NormalizedAd>();
    for (const ad of ads) {
      if (!dedupMap.has(ad.id)) dedupMap.set(ad.id, ad);
    }
    const uniqueAds = Array.from(dedupMap.values());

    // Persist to ads table — reuses the exact same pipeline as Discover
    const { persisted, error: persistError } = await persistNormalizedAds(uniqueAds);
    if (persistError) {
      console.error(`${logPrefix} Persistence error: ${persistError}`);
    }

    const durationMs = Date.now() - startMs;
    console.info(`${logPrefix} Sync complete: ${uniqueAds.length} fetched, ${persisted} persisted, ${durationMs}ms`);

    // Update competitor record with resolved identity from actual provider data ONLY if persistence succeeded
    if (!persistError) {
      try {
        const firstAd = uniqueAds[0];
        const resolvedName = realAdvertiserName(firstAd?.advertiser?.name, firstAd?.advertiser?.id);
        const resolvedAvatar = firstAd?.advertiser?.logoUrl;
        
        if (
          resolvedName && 
          resolvedName !== "Unknown" && 
          resolvedName !== "Unknown advertiser" &&
          !/^\d+$/.test(resolvedName)
        ) {
          await supabase
            .from("competitors")
            .update({
              advertiser_name: resolvedName,
              advertiser_avatar_url: resolvedAvatar || undefined,
              last_synced_at: new Date().toISOString(),
            })
            .eq("advertiser_id", advertiserId);
        } else {
          // Still update last_synced_at even if name wasn't resolved
          await supabase
            .from("competitors")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("advertiser_id", advertiserId);
        }
      } catch (updateErr) {
        console.error(`${logPrefix} Failed to update competitor identity:`, updateErr);
      }
    }

    return persisted;
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    throw error;
  }
}

async function loadCompetitorBrandIdentity(
  supabase: ReturnType<typeof createAdminClient>,
  advertiserId: string
): Promise<BrandIdentity | undefined> {
  const { data: rows } = await supabase
    .from("ads")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .order("last_seen_at", { ascending: false })
    .limit(100);
  const fromAds = (rows || []).map(brandFromRow).find(Boolean);
  if (fromAds) return fromAds;

  const { data: competitor } = await supabase
    .from("competitors")
    .select("advertiser_name, advertiser_avatar_url")
    .eq("advertiser_id", advertiserId)
    .maybeSingle();
  const name = realAdvertiserName(competitor?.advertiser_name, advertiserId);
  if (!name) return undefined;
  return {
    id: advertiserId,
    name,
    provider: "meta",
    providerAdvertiserId: advertiserId,
    logoUrl: competitor?.advertiser_avatar_url || null,
  };
}

async function loadProfileIdentity(
  supabase: ReturnType<typeof createAdminClient>,
  advertiserId: string,
  competitorRecord?: IdentityRecord | null,
  displayNameHint?: string
): Promise<IdentityRecord | null> {
  const competitorName = realAdvertiserName(competitorRecord?.advertiser_name, advertiserId);
  if (competitorName) return { ...competitorRecord, advertiser_name: competitorName };

  const hintName = realAdvertiserName(displayNameHint, advertiserId);
  if (hintName) {
    return {
      ...competitorRecord,
      advertiser_name: hintName,
      advertiser_avatar_url: competitorRecord?.advertiser_avatar_url || null,
    };
  }

  const { data: rows } = await supabase
    .from("ads")
    .select("*")
    .eq("advertiser_id", advertiserId)
    .order("last_seen_at", { ascending: false })
    .limit(100);
  const fromAds = (rows || []).map(brandFromRow).find(Boolean);
  if (!fromAds) return null;
  return {
    ...competitorRecord,
    advertiser_name: fromAds.name,
    advertiser_avatar_url: fromAds.logoUrl || competitorRecord?.advertiser_avatar_url || null,
  };
}

/**
 * Core normalization logic to convert a raw list of ads into intelligence metrics.
 * This is the SINGLE canonical source for calculating competitor stats.
 */
function buildCompetitorIntelligence(
  advertiserId: string,
  ads: BulkAdRow[],
  trackedRecord?: IdentityRecord | null
): CompetitorIntelligence {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString();

  // Identity Resolution Priority: 
  // 1. Tracked competitor DB record (highest priority - user-set or canonical value)
  // 2. First ad's advertiser name (from provider)
  // 3. Fallback based on sync status
  let brandName = realAdvertiserName(trackedRecord?.advertiser_name, advertiserId);
  let logoUrl = trackedRecord?.advertiser_avatar_url || null;

  if (brandName) {
    // Use canonical name (highest priority)
  } else if (ads.length > 0) {
    // Use provider name from ads
    brandName = realAdvertiserName(ads[0].advertiser_name, advertiserId) || "";
    logoUrl = ads[0].advertiser_avatar_url || null;
  } else {
    // No tracked name and no ads - determine fallback
    if (trackedRecord?.sync_status === "syncing") {
      brandName = "";
    } else if (trackedRecord?.sync_status === "error") {
      brandName = "";
    } else {
      brandName = "";
    }
  }

  // Safety: ensure the profile never renders an opaque provider ID as the brand name.
  if (!brandName || brandName.trim() === "") {
    brandName = "Brand";
  }

  // Deduplicate Ads by canonical ID
  const uniqueAdsMap = new Map<string, BulkAdRow>();
  for (const ad of ads) {
    const existing = uniqueAdsMap.get(ad.canonical_ad_id);
    // Prefer the active state if there's a conflict
    if (!existing || (ad.status === "active" && existing.status !== "active")) {
      uniqueAdsMap.set(ad.canonical_ad_id, ad);
    }
  }
  const distinctAds = Array.from(uniqueAdsMap.values());
  
  // Seeded randomization over the bounded ad result set (by day and brand)
  const today = new Date().toISOString().split("T")[0];
  const seedString = `${advertiserId}-${today}`;
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed << 5) - seed + seedString.charCodeAt(i);
    seed |= 0;
  }
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  
  distinctAds.sort(() => random() - 0.5);

  // Counts
  const activeAdsCount = distinctAds.filter(a => a.status === "active").length;
  const uniqueAdsCount = distinctAds.length;
  const totalAds = ads.length;

  // Trends
  const newAdsThisWeek = distinctAds.filter(a => a.start_date && a.start_date >= oneWeekAgoStr).length;
  const stoppedAdsThisWeek = distinctAds.filter(a => a.status !== "active" && a.end_date && a.end_date >= oneWeekAgoStr).length;

  // Durations
  const activeDays = distinctAds
    .map(ad => typeof ad.running_days === "number" && ad.running_days > 0
      ? ad.running_days
      : ad.start_date ? Math.max(1, Math.ceil((Date.now() - new Date(ad.start_date).getTime()) / 86_400_000)) : null)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0);
  const longest = activeDays.length > 0 ? Math.max(...activeDays) : null;
  const average = activeDays.length > 0 ? Math.round(activeDays.reduce((sum, d) => sum + d, 0) / activeDays.length) : null;

  // Platforms Set
  const platformsSet = new Set<string>();
  distinctAds.forEach(a => {
    if (a.platforms) a.platforms.forEach((p: string) => platformsSet.add(p));
  });

  // Previews
  const latestCreatives = distinctAds
    .map(row => {
      const media = resolveAdMedia(dbAdToNormalized(row as unknown as Parameters<typeof dbAdToNormalized>[0]));
      const url = media.thumbnailUrl || media.imageUrl || media.videoUrl || media.carouselAssets?.[0] || null;
      return url ? { id: row.canonical_ad_id, url, type: media.kind as string } : null;
    })
    .filter((item): item is CreativePreview => Boolean(item))
    .slice(0, 10);

  // Dates
  const allStartDates = distinctAds.map(a => a.start_date).filter((d): d is string => Boolean(d)).sort();
  const firstSeenAt = allStartDates.length > 0 ? allStartDates[0] : null;
  const lastActivityAt = allStartDates.length > 0 ? allStartDates[allStartDates.length - 1] : null;

  // Analytics Distributions
  const mediaDistribution = countBy(distinctAds.map(row => row.media_type));
  const ctaDistribution = countBy(distinctAds.map(row => row.cta).filter((cta): cta is string => Boolean(cta)));

  return {
    advertiserId,
    brandName,
    logoUrl,
    platforms: Array.from(platformsSet),
    category: null,
    activeAds: activeAdsCount,
    uniqueAds: uniqueAdsCount,
    totalAds,
    newAdsThisWeek,
    stoppedAdsThisWeek,
    longestRunningDays: longest,
    averageRunningDays: average,
    latestCreatives,
    trackedSince: trackedRecord?.created_at || null,
    lastActivityAt,
    firstSeenAt,
    lastSyncedAt: trackedRecord?.last_synced_at || null,
    syncStatus: trackedRecord?.sync_status || null,
    syncError: trackedRecord?.sync_error || null,
    competitorStatus: trackedRecord?.status || "tracking",
    adsCount: trackedRecord?.ads_count ?? (ads.length > 0 ? ads.length : -1),
    mediaDistribution,
    ctaDistribution,
  };
}

const BRAND_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours config

/**
 * Gets the intelligence for a single competitor (Intelligence Page).
 * Safely handles syncing if no data exists or is stale.
 */
export async function getCompetitorIntelligence(id: string, allowSync = true, userId?: string, displayNameHint?: string): Promise<CompetitorIntelligence> {
  const supabase = createAdminClient();

  // 1. Fetch tracked competitor record for custom name overriding & cache freshness
  let query = supabase
    .from("competitors")
    .select("advertiser_name, advertiser_avatar_url, created_at, sync_status, sync_error, last_synced_at, ads_count, status")
    .eq("advertiser_id", id);
  
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data: competitorRecord } = await query.limit(1).maybeSingle();

  const fetchAds = async () => {
    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("advertiser_id", id);
    return (data || []) as BulkAdRow[];
  };

  let ads = await fetchAds();
  const profileIdentity = await loadProfileIdentity(supabase, id, competitorRecord, displayNameHint);

  // 2. Cache-First Logic: Check if we need to sync based on TTL
  const lastSynced = competitorRecord?.last_synced_at ? new Date(competitorRecord.last_synced_at).getTime() : 0;
  const isStale = Date.now() - lastSynced > BRAND_CACHE_TTL_MS;
  const isMissing = ads.length === 0;

  if ((isMissing || isStale) && allowSync) {
    try {
      const synced = await syncCompetitorAds(id);
      if (synced > 0) {
        ads = await fetchAds();
      }
    } catch (err) {
      console.warn(`Inline sync failed for ${id}:`, err);
    }
  }

  // 3. Fallback identity if still unknown
  let fallbackRecord = profileIdentity || competitorRecord;
  if (ads.length === 0 && !fallbackRecord) {
    try {
      const providers = getAdProviders({ brand: id });
      if (providers.length && providers[0].provider.getAdvertiser) {
        const adv = await providers[0].provider.getAdvertiser(id);
        if (adv) {
          fallbackRecord = {
            advertiser_name: adv.name,
            advertiser_avatar_url: adv.avatarUrl,
            created_at: new Date().toISOString(),
            sync_status: undefined,
            sync_error: undefined,
            last_synced_at: undefined,
            ads_count: undefined,
            status: undefined
          };
        }
      }
    } catch { }
  }

  const intelligence = buildCompetitorIntelligence(id, ads, fallbackRecord);
  const signedUrls = await signArchivedMediaUrls(intelligence.latestCreatives.map(({ url }) => url));
  intelligence.latestCreatives = intelligence.latestCreatives.map((creative) => ({
    ...creative,
    url: signedUrls.get(creative.url) || creative.url,
  }));
  return intelligence;
}

/**
 * Bulk fetches intelligence for the competitor cards list.
 */
export async function getCompetitorSummaries(trackedRecords: TrackedRecord[]): Promise<CompetitorIntelligence[]> {
  if (!isSupabaseConfigured || !trackedRecords.length) return [];

  const supabase = createAdminClient();
  const advertiserIds = trackedRecords.map(r => r.advertiser_id);

  const { data: adsData } = await supabase
    .from("ads")
    .select("*")
    .in("advertiser_id", advertiserIds)
    .order("start_date", { ascending: false });

  const rows = (adsData || []) as BulkAdRow[];

  // Group by advertiser_id
  const groupedAds = new Map<string, BulkAdRow[]>();
  for (const row of rows) {
    if (!groupedAds.has(row.advertiser_id)) {
      groupedAds.set(row.advertiser_id, []);
    }
    groupedAds.get(row.advertiser_id)!.push(row);
  }

  const summaries = trackedRecords.map(record => {
    const id = record.advertiser_id;
    const advertiserAds = groupedAds.get(id) || [];
    return buildCompetitorIntelligence(id, advertiserAds, record);
  });
  const signedUrls = await signArchivedMediaUrls(
    summaries.flatMap((summary) => summary.latestCreatives.map(({ url }) => url))
  );
  return summaries.map((summary) => ({
    ...summary,
    latestCreatives: summary.latestCreatives.map((creative) => ({
      ...creative,
      url: signedUrls.get(creative.url) || creative.url,
    })),
  }));
}

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}

// BACKWARD COMPATIBILITY for Analytics and brand directory

export type BrandData = {
  id: string;
  name: string;
  avatar: string | null;
  active: number;
  inactive: number;
  total: number;
  longest: number;
  earliest: string | null;
  media: Record<string, number>;
  ctas: Record<string, number>;
  platforms: Record<string, number>;
  previews: CreativePreview[];
};

export type BrandSummary = {
  id: string;
  name: string;
  avatar: string | null;
  platforms: string[];
  totalUnique: number | null;
  activeUnique: number | null;
  previewMedia: string[];
  previewThumbs: string[];
};

export async function getBrandStats(advertiserIds: string[]) {
  if (!isSupabaseConfigured || advertiserIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_brand_ad_stats", {
    p_advertiser_ids: advertiserIds
  });
  if (error || !data) return [];
  return data as { advertiser_id: string; total_ads: number; active_ads: number; latest_activity_at: string }[];
}

export async function getBrands(query?: string, externalCandidates: BrandSummary[] = []): Promise<BrandSummary[]> {
  if (!isSupabaseConfigured) return externalCandidates;
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("search_brands", {
    query_text: query?.trim() || null,
    max_results: 40
  });

  let catalogBrands: BrandSummary[] = [];
  if (!error && data) {
    catalogBrands = data.map((row: Record<string, unknown>) => ({
      id: row.advertiser_id as string,
      name: row.advertiser_name as string,
      avatar: row.advertiser_avatar_url as string | null,
      platforms: (row.platforms as string[]) || [],
      totalUnique: null, // Will be overridden
      activeUnique: null, // Will be overridden
      previewMedia: (row.preview_media as string[]) || [],
      previewThumbs: (row.preview_thumbs as string[]) || []
    }));
  }

  // Merge external candidates and catalog brands (prefer catalog metadata)
  const mergedMap = new Map<string, BrandSummary>();
  for (const b of externalCandidates) mergedMap.set(b.id, b);
  for (const b of catalogBrands) {
    const existing = mergedMap.get(b.id);
    if (existing) {
      // Merge previews if catalog is empty
      if (b.previewMedia.length === 0) b.previewMedia = existing.previewMedia;
      if (b.previewThumbs.length === 0) b.previewThumbs = existing.previewThumbs;
      // Merge platforms
      b.platforms = Array.from(new Set([...b.platforms, ...existing.platforms]));
    }
    mergedMap.set(b.id, b);
  }

  const merged = Array.from(mergedMap.values());
  const advertiserIds = merged.map(b => b.id);
  
  if (advertiserIds.length > 0) {
    const stats = await getBrandStats(advertiserIds);
    const statsMap = new Map(stats.map(s => [s.advertiser_id, s]));
    
    for (const b of merged) {
      const stat = statsMap.get(b.id);
      if (stat && stat.total_ads > 0) {
        b.totalUnique = Number(stat.total_ads);
        b.activeUnique = Number(stat.active_ads);
      } else {
        b.totalUnique = null;
        b.activeUnique = null;
      }
    }
  }

  // Sort by total unique ads
  merged.sort((a, b) => (b.totalUnique || 0) - (a.totalUnique || 0));

  const signedUrls = await signArchivedMediaUrls(
    merged.flatMap((brand) => [...brand.previewMedia, ...brand.previewThumbs])
  );
  return merged.map((brand) => ({
    ...brand,
    previewMedia: brand.previewMedia.map((url) => signedUrls.get(url) || url),
    previewThumbs: brand.previewThumbs.map((url) => signedUrls.get(url) || url),
  }));
}

export async function getBrandData(id: string): Promise<BrandData> {
  const intel = await getCompetitorIntelligence(id, false);
  return {
    id: intel.advertiserId,
    name: intel.brandName,
    avatar: intel.logoUrl,
    active: intel.activeAds,
    inactive: intel.uniqueAds - intel.activeAds,
    total: intel.uniqueAds,
    longest: intel.longestRunningDays || 0,
    earliest: intel.firstSeenAt,
    media: intel.mediaDistribution,
    ctas: intel.ctaDistribution,
    platforms: intel.platforms.reduce((acc, p) => ({ ...acc, [p]: 1 }), {}),
    previews: intel.latestCreatives
  };
}
