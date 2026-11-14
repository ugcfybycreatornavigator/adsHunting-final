import "server-only";
import type { NormalizedAd } from "@/lib/types";
import { dbAdToNormalized, normalizedToDb } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveMediaFromUrl } from "./media-archiver";
import { integrationConfig } from "@/lib/env/server";

import { realAdvertiserName, resolveAdvertiser } from "@/lib/advertiser-identity";
import { calculateWinnerScore } from "@/lib/intelligence";

export async function persistNormalizedAds(ads: NormalizedAd[]) {
  if (!ads.length || !integrationConfig().supabase) return { persisted: 0, error: null };
  try {
    const admin = createAdminClient();
    const persistableAds = ads.filter(ad => Boolean(
      ad.id && ad.externalId && ad.advertiser.id && ad.advertiser.id !== "unknown" &&
      realAdvertiserName(ad.advertiser.name, ad.advertiser.id)
    ));
    if (persistableAds.length !== ads.length) {
      console.warn(`[Persistence] Skipped ${ads.length - persistableAds.length} ads without canonical advertiser identity.`);
    }
    if (!persistableAds.length) return { persisted: 0, error: "No ads had a canonical advertiser identity." };
    
    // Batch by ad ID as well: an update may omit the advertiser ID entirely.
    const { data: existingRows, error: identityError } = await admin.from("ads").select("*")
      .in("canonical_ad_id", persistableAds.map(ad => ad.id));
    if (identityError) return { persisted: 0, error: "Existing advertiser identity could not be loaded safely." };
    const existingById = new Map((existingRows || []).map(row => [row.canonical_ad_id, dbAdToNormalized(row)]));
    const existingCatalogRows = new Map((existingRows || []).map(row => [row.canonical_ad_id, row]));
    for (const ad of persistableAds) {
      const existing = existingById.get(ad.id);
      if (!existing) continue;
      if (!ad.advertiser.id || ad.advertiser.id === "unknown") ad.advertiser.id = existing.advertiser.id;
      if (ad.advertiser.id === existing.advertiser.id) {
        ad.advertiser = resolveAdvertiser(ad.advertiser, undefined, undefined, existing.advertiser);
      } else if (!ad.advertiser.name) {
        return { persisted: 0, error: "Conflicting advertiser identity on an existing ad." };
      }
    }

    // Group incoming ads by advertiser
    const adsByAdvertiser = new Map<string, NormalizedAd[]>();
    for (const ad of persistableAds) {
      const advId = ad.advertiser.id!;
      if (!adsByAdvertiser.has(advId)) adsByAdvertiser.set(advId, []);
      adsByAdvertiser.get(advId)!.push(ad);
    }

    const allAdsToUpsert: NormalizedAd[] = [];

    // For each advertiser, fetch existing ads to build a targeted scoring context
    for (const [advId, incomingAds] of adsByAdvertiser.entries()) {
      // Query active ads and ads started within the last 30 days for this advertiser.
      // Winner scoring specifically inspects active ads (for landing page reuse persistence, max 5)
      // and ads launched in the last 30 days (for creative refresh velocity, max 5).
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: dbAds } = await admin
        .from("ads")
        .select("*")
        .eq("advertiser_id", advId)
        .or(`status.eq.active,start_date.gte.${thirtyDaysAgoIso}`)
        .order("last_seen_at", { ascending: false })
        .limit(200);
      
      const existingAds: NormalizedAd[] = [];
      if (dbAds && dbAds.length > 0) {
        for (const row of dbAds) {
          try {
            existingCatalogRows.set(row.canonical_ad_id, row);
            existingAds.push(dbAdToNormalized(row));
          } catch {
             // Ignore malformed refined_data
          }
        }
      }

      // Also ensure any existing rows matching the incoming ads are included in existingAds context
      for (const ad of incomingAds) {
        const existingRow = existingCatalogRows.get(ad.id);
        if (existingRow && !existingAds.some(e => e.id === ad.id)) {
          try {
            existingAds.push(dbAdToNormalized(existingRow));
          } catch {
             // Ignore
          }
        }
      }

      // Merge incoming with existing context, preferring incoming on ID conflict
      const mergedMap = new Map<string, NormalizedAd>();
      for (const ad of existingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      for (const ad of incomingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      
      const fullAdvertiserContext = Array.from(mergedMap.values());

      // Calculate winner scores with targeted context and ONLY upsert incoming ads
      // rather than rewriting the entire historical catalog to the database on every search
      for (const ad of incomingAds) {
        ad.intelligence.winnerScore = calculateWinnerScore(ad, { advertiserAds: fullAdvertiserContext });
        allAdsToUpsert.push(ad);
      }
    }

    // Now convert all recalculated ads to DB rows and upsert them
    const incomingCanonicalIds = new Set(persistableAds.map(ad => ad.id));
    const rows = allAdsToUpsert.map(ad => {
      const row = normalizedToDb(ad);
      const existing = existingCatalogRows.get(ad.id);
      if (existing) {
        // 1. Preserve historical provider ad IDs and increment observation count
        row.provider_ad_ids = [...new Set([...(existing.provider_ad_ids || []), ...(row.provider_ad_ids || [])])];
        row.observation_count = Number(existing.observation_count || 1) + (incomingCanonicalIds.has(ad.id) ? 1 : 0);

        // 2. Preserve historical discovery timestamp
        if (existing.first_seen_at) {
          row.first_seen_at = existing.first_seen_at;
        }

        // 3. Preserve permanent media archival state
        if (existing.archive_status === "archived") {
          row.archive_status = "archived";
          if (existing.stored_media_path) row.stored_media_path = existing.stored_media_path;
          if (existing.source_media_url && existing.source_media_url.includes("supabase.co")) {
            row.source_media_url = existing.source_media_url;
          }
          if (existing.thumbnail_url && existing.thumbnail_url.includes("supabase.co")) {
            row.thumbnail_url = existing.thumbnail_url;
          }
        }

        // 4. Preserve earliest known start_date and recalculate running days
        if (existing.start_date) {
          const incomingStart = row.start_date ? new Date(row.start_date).getTime() : Infinity;
          const existingStart = new Date(existing.start_date).getTime();
          if (Number.isFinite(existingStart) && existingStart <= incomingStart) {
            row.start_date = existing.start_date;
          }
        }
        if (row.start_date) {
          const startMs = new Date(row.start_date).getTime();
          const stopMs = row.stop_date ? new Date(row.stop_date).getTime() : Date.now();
          if (Number.isFinite(startMs) && stopMs >= startMs) {
            row.running_days = Math.max(0, Math.floor((stopMs - startMs) / 86_400_000));
          }
        }
      }
      return row;
    });
    
    const validRows = [];
    const invalidRows = [];
    for (const row of rows) {
      if (row.canonical_ad_id && row.advertiser_id && row.raw_data && row.media_type) {
        validRows.push(row);
      } else {
        invalidRows.push({
           id: row.canonical_ad_id,
           hasRawData: !!row.raw_data,
           hasAdvertiserId: !!row.advertiser_id,
           hasMediaType: !!row.media_type
        });
      }
    }

    if (invalidRows.length > 0) {
      console.warn(`[Persistence] Validation failed for ${invalidRows.length} rows:`, JSON.stringify(invalidRows.slice(0, 5)));
    }
    
    // Chunk upserts if necessary, but typically < 1000
    const chunkSize = 500;
    let hasError = false;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const { error } = await admin.from("ads").upsert(chunk, { 
        onConflict: "canonical_ad_id",
        ignoreDuplicates: false 
      });
      if (error) {
        console.error("[Persistence] Chunk upsert error:", error);
        hasError = true;
      }
    }
    
    // Return only the count of the newly provided ads that we actually intended to persist
    return { persisted: persistableAds.length, error: hasError ? "Some chunks failed to persist" : null };
  } catch (error) {
    console.error("Persistence error:", error);
    return { persisted: 0, error: "Normalized ads could not be persisted." };
  }
}

export function adsForClient(ads: NormalizedAd[]) {
  return ads.map(ad => { const clientAd = { ...ad }; return clientAd; });
}

export async function archiveAdsInBackground(ads: NormalizedAd[]) {
  const config = integrationConfig();
  if (!ads.length || !config.supabase || !config.mediaArchival) return;
  const admin = createAdminClient();
  
  
  for (const ad of ads) {
    if (ad.enrichment?.archiveStatus === "archived" || ad.enrichment?.archiveStatus === "unavailable" || ad.enrichment?.archiveStatus === "failed") continue;
    if (!ad.creative?.imageUrl && !ad.creative?.videoUrl && !ad.creative?.carouselItems?.length) continue;
    
    let newSourceUrl = ad.creative.videoUrl || ad.creative.imageUrl;
    let newThumbnailUrl = ad.creative.thumbnailUrl;
    const newCarouselAssets: string[] = [];
    const newCarouselItems: NormalizedAd["creative"]["carouselItems"] = [];
    let storedMediaPath: string | null = null;
    let failed = false;
    
    if (newSourceUrl && !newSourceUrl.includes("supabase.co")) {
      const ext = newSourceUrl.includes(".mp4") ? "mp4" : "webp";
      const path = `${ad.provider.discoveryProvider}/${ad.id}/source.${ext}`;
      const res = await archiveMediaFromUrl(admin, newSourceUrl, path);
      if (res.path) {
         storedMediaPath = res.path;
         newSourceUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      } else {
         failed = true;
      }
    }
    
    if (newThumbnailUrl && !newThumbnailUrl.includes("supabase.co")) {
      const path = `${ad.provider.discoveryProvider}/${ad.id}/thumbnail.webp`
      const res = await archiveMediaFromUrl(admin, newThumbnailUrl, path);
      if (res.path) {
         newThumbnailUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      }
    }
    
    if (ad.creative.carouselItems && ad.creative.carouselItems.length > 0) {
       for (let i = 0; i < ad.creative.carouselItems.length; i++) {
          const item = ad.creative.carouselItems[i];
          const isVideo = Boolean(item.videoUrl);
          const assetUrl = item.videoUrl || item.imageUrl;
          if (!assetUrl) continue;
          if (assetUrl.includes("supabase.co")) {
             newCarouselAssets.push(assetUrl);
             newCarouselItems.push(item);
             continue;
          }
          const ext = assetUrl.includes(".mp4") ? "mp4" : "webp";
          const path = `${ad.provider.discoveryProvider}/${ad.id}/carousel-${i}.${ext}`;
          const res = await archiveMediaFromUrl(admin, assetUrl, path);
          if (res.path) {
             const archivedUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
             newCarouselAssets.push(archivedUrl);
             newCarouselItems.push({
               ...item,
               imageUrl: isVideo ? item.imageUrl : archivedUrl,
               videoUrl: isVideo ? archivedUrl : item.videoUrl,
             });
          } else {
             newCarouselAssets.push(assetUrl);
             newCarouselItems.push(item);
          }
       }
    }
    
    const finalStatus = failed ? "failed" : "archived";
    
    const archivedAd: NormalizedAd = {
      ...ad,
      creative: {
        ...ad.creative,
        imageUrl: ad.creative.type === "video" ? ad.creative.imageUrl : newSourceUrl,
        videoUrl: ad.creative.type === "video" ? newSourceUrl : ad.creative.videoUrl,
        thumbnailUrl: newThumbnailUrl,
        carouselItems: newCarouselItems.length ? newCarouselItems : ad.creative.carouselItems,
      },
      enrichment: { ...ad.enrichment, archiveStatus: finalStatus },
    };

    const { error } = await admin.from("ads").update({
      source_media_url: newSourceUrl,
      thumbnail_url: newThumbnailUrl,
      carousel_assets: newCarouselAssets,
      stored_media_path: storedMediaPath,
      refined_data: archivedAd,
      archive_status: finalStatus,
    }).eq("canonical_ad_id", ad.id);
    if (error) console.error("[Persistence] Failed to store archived media references.", error);
  }
}
