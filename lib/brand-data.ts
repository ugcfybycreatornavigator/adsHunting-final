import { isSupabaseConfigured } from "@/lib/env";
import { getServerEnv, isSearchConfigured } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdProviders } from "@/lib/providers";
import { auth } from "@clerk/nextjs/server";
import { persistNormalizedAds } from "@/lib/ads-persistence";

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
};

/**
 * Triggers an immediate API sync for the given competitor's ads and saves them to the DB.
 * Returns the number of ads persisted, or -1 on failure.
 */
export async function syncCompetitorAds(advertiserId: string, providedToken?: string | null): Promise<number> {
  const logPrefix = `[CompetitorSync][${advertiserId}]`;
  const startMs = Date.now();
  try {
    const env = getServerEnv();
    if (!env.supabaseUrl) {
      console.warn(`${logPrefix} Supabase not configured`);
      return -1;
    }
    
    // We need a Clerk token because the edge function validates it
    let token = providedToken;
    if (!token) {
      try {
        const authObj = await auth();
        token = await authObj.getToken();
      } catch {
        // May fail if called outside of request context without token
      }
    }
    
    if (!token) {
      console.warn(`${logPrefix} Missing Clerk token, cannot authenticate to edge function`);
      return -1;
    }

    const functionUrl = `${env.supabaseUrl}/functions/v1/ads-search`;
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ brand: advertiserId, status: "all" }),
      signal: AbortSignal.timeout(25_000),
    });
    
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`${logPrefix} Edge function error: ${res.status} ${errText}`);
      return -1;
    }

    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.ads)) {
      console.warn(`${logPrefix} Edge function returned no ads array`);
      return 0;
    }

    const ads = data.ads as import("@/lib/types").NormalizedAd[];
    if (ads.length === 0) {
      console.info(`${logPrefix} Provider returned 0 ads`);
      return 0;
    }

    // Deduplicate by ad ID before persisting
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

    // Update competitor record with resolved identity from actual provider data
    try {
      const firstAd = uniqueAds[0];
      const resolvedName = firstAd.advertiser?.name;
      const resolvedAvatar = firstAd.advertiser?.logoUrl;
      if (resolvedName && resolvedName !== "Unknown" && resolvedName !== "Unknown advertiser") {
        const supabase = createAdminClient();
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
        const supabase = createAdminClient();
        await supabase
          .from("competitors")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("advertiser_id", advertiserId);
      }
    } catch (updateErr) {
      console.error(`${logPrefix} Failed to update competitor identity:`, updateErr);
    }

    return persisted;
  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return -1;
  }
}

/**
 * Core normalization logic to convert a raw list of ads into intelligence metrics.
 * This is the SINGLE canonical source for calculating competitor stats.
 */
function buildCompetitorIntelligence(
  advertiserId: string,
  ads: BulkAdRow[],
  trackedRecord?: (Partial<TrackedRecord> & { sync_status?: string; ads_count?: number }) | null
): CompetitorIntelligence {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString();

  // Identity Resolution Priority: 
  // 1. Tracked competitor DB record (highest priority - user-set value)
  // 2. First ad's advertiser name (from provider)
  // 3. Fallback based on sync status
  let brandName = trackedRecord?.advertiser_name;
  let logoUrl = trackedRecord?.advertiser_avatar_url || null;

  if (brandName && brandName.trim() !== "") {
    // Use tracked name (highest priority)
  } else if (ads.length > 0) {
    // Use provider name from ads
    brandName = ads[0].advertiser_name;
    logoUrl = ads[0].advertiser_avatar_url || null;
  } else {
    // No tracked name and no ads - determine fallback
    if (trackedRecord?.sync_status === "syncing") {
      brandName = "Fetching advertiser...";
    } else if (trackedRecord?.sync_status === "error") {
      brandName = `${advertiserId}`;
    } else {
      // Default fallback to provider ID
      brandName = `${advertiserId}`;
    }
  }

  // Safety: ensure we always have a brand name
  if (!brandName || brandName.trim() === "") {
    brandName = `${advertiserId}`;
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

  // Counts
  const activeAdsCount = distinctAds.filter(a => a.status === "active").length;
  const uniqueAdsCount = distinctAds.length;
  const totalAds = ads.length;

  // Trends
  const newAdsThisWeek = distinctAds.filter(a => a.start_date && a.start_date >= oneWeekAgoStr).length;
  const stoppedAdsThisWeek = distinctAds.filter(a => a.status !== "active" && a.end_date && a.end_date >= oneWeekAgoStr).length;

  // Durations
  const activeDays = distinctAds.map(a => a.running_days).filter((d): d is number => typeof d === "number" && d > 0);
  const longest = activeDays.length > 0 ? Math.max(...activeDays) : null;
  const average = activeDays.length > 0 ? Math.round(activeDays.reduce((sum, d) => sum + d, 0) / activeDays.length) : null;

  // Platforms Set
  const platformsSet = new Set<string>();
  distinctAds.forEach(a => {
    if (a.platforms) a.platforms.forEach((p: string) => platformsSet.add(p));
  });

  // Previews
  const latestCreatives = distinctAds
    .filter(a => a.thumbnail_url || a.source_media_url)
    .slice(0, 10)
    .map(a => ({
      id: a.canonical_ad_id,
      url: (a.thumbnail_url || a.source_media_url) as string,
      type: a.media_type
    }));

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

/**
 * Gets the intelligence for a single competitor (Intelligence Page).
 * Safely handles syncing if no data exists.
 */
export async function getCompetitorIntelligence(id: string, allowSync = true): Promise<CompetitorIntelligence> {
  const supabase = createAdminClient();

  const fetchAds = async () => {
    const { data } = await supabase
      .from("ads")
      .select("advertiser_id, advertiser_name, advertiser_avatar_url, status, running_days, start_date, media_type, cta, platforms, canonical_ad_id, source_media_url, thumbnail_url, end_date")
      .eq("advertiser_id", id)
      .order("start_date", { ascending: false });
    return (data || []) as BulkAdRow[];
  };

  let ads = await fetchAds();

  // If no ads exist, trigger an inline sync and refetch (only if allowed)
  if (ads.length === 0 && allowSync) {
    const synced = await syncCompetitorAds(id);
    if (synced > 0) {
      ads = await fetchAds();
    }
  }

  // Attempt to fetch the tracked competitor record for custom name overriding
  const { data: competitorRecord } = await supabase
    .from("competitors")
    .select("advertiser_name, advertiser_avatar_url, created_at, sync_status, sync_error, last_synced_at, ads_count, status")
    .eq("advertiser_id", id)
    .maybeSingle();

  // If there are still no ads AND we didn't have a tracked record, try to fetch fallback advertiser details
  // so the intelligence page doesn't just say "Meta advertiser 123"
  let fallbackRecord = competitorRecord;
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

  return buildCompetitorIntelligence(id, ads, fallbackRecord);
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
    .select("advertiser_id, advertiser_name, advertiser_avatar_url, status, running_days, start_date, media_type, cta, platforms, canonical_ad_id, source_media_url, thumbnail_url, end_date")
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

  return trackedRecords.map(record => {
    const id = record.advertiser_id;
    const advertiserAds = groupedAds.get(id) || [];
    return buildCompetitorIntelligence(id, advertiserAds, record);
  });
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

  return merged;
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
