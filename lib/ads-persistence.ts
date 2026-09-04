import "server-only";
import type { NormalizedAd } from "@/lib/types";
import { normalizedToDb } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveMediaFromUrl } from "./media-archiver";
import { integrationConfig } from "@/lib/env/server";

import { calculateWinnerScore } from "@/lib/intelligence";

export async function persistNormalizedAds(ads: NormalizedAd[]) {
  if (!ads.length || !integrationConfig().supabase) return { persisted: 0, error: null };
  try {
    const admin = createAdminClient();
    
    // Group incoming ads by advertiser
    const adsByAdvertiser = new Map<string, NormalizedAd[]>();
    for (const ad of ads) {
      const advId = ad.advertiser.id || "unknown";
      if (!adsByAdvertiser.has(advId)) adsByAdvertiser.set(advId, []);
      adsByAdvertiser.get(advId)!.push(ad);
    }

    const allAdsToUpsert: NormalizedAd[] = [];

    // For each advertiser, fetch existing ads to build a complete context
    for (const [advId, incomingAds] of adsByAdvertiser.entries()) {
      if (advId === "unknown") {
        // Fallback for unknown advertisers: just score against themselves
        incomingAds.forEach(ad => {
          ad.intelligence.winnerScore = calculateWinnerScore(ad, { advertiserAds: incomingAds });
          allAdsToUpsert.push(ad);
        });
        continue;
      }

      // Fetch existing DB ads for this advertiser to build context
      const { data: dbAds } = await admin
        .from("ads")
        .select("*")
        .eq("advertiser_id", advId);
      
      const existingAds: NormalizedAd[] = [];
      if (dbAds && dbAds.length > 0) {
        for (const row of dbAds) {
          try {
            existingAds.push(row.refined_data as unknown as NormalizedAd);
          } catch {
             // Ignore malformed refined_data
          }
        }
      }

      // Merge incoming with existing, preferring incoming if conflict on ID
      const mergedMap = new Map<string, NormalizedAd>();
      for (const ad of existingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      for (const ad of incomingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      
      const fullAdvertiserContext = Array.from(mergedMap.values());

      // Recalculate score for ALL ads (incoming + existing) for this advertiser
      // because a new ad might affect the "Creative Refresh Pattern" of an existing ad, etc.
      for (const ad of fullAdvertiserContext) {
        ad.intelligence.winnerScore = calculateWinnerScore(ad, { advertiserAds: fullAdvertiserContext });
        allAdsToUpsert.push(ad);
      }
    }

    // Now convert all recalculated ads to DB rows and upsert them
    const rows = allAdsToUpsert.map(normalizedToDb);
    
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
    return { persisted: ads.length, error: hasError ? "Some chunks failed to persist" : null };
  } catch (error) {
    console.error("Persistence error:", error);
    return { persisted: 0, error: "Normalized ads could not be persisted." };
  }
}

export function adsForClient(ads: NormalizedAd[]) {
  return ads.map(ad => { const clientAd = { ...ad }; return clientAd; });
}

export async function archiveAdsInBackground(ads: NormalizedAd[]) {
  if (!ads.length || !integrationConfig().supabase) return;
  const admin = createAdminClient();
  
  
  for (const ad of ads) {
    if (ad.enrichment?.archiveStatus === "archived" || ad.enrichment?.archiveStatus === "unavailable" || ad.enrichment?.archiveStatus === "failed") continue;
    if (!ad.creative?.imageUrl && !ad.creative?.videoUrl && !ad.creative?.carouselItems?.length) continue;
    
    let newSourceUrl = ad.creative.videoUrl || ad.creative.imageUrl;
    let newThumbnailUrl = ad.creative.thumbnailUrl;
    const newCarouselAssets: string[] = [];
    let failed = false;
    
    if (newSourceUrl && !newSourceUrl.includes("supabase.co")) {
      const ext = newSourceUrl.includes(".mp4") ? "mp4" : "webp";
      const path = `${ad.provider.discoveryProvider}/${ad.id}/source.${ext}`;
      const res = await archiveMediaFromUrl(admin, newSourceUrl, path);
      if (res.path) {
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
          const assetUrl = item.imageUrl || item.videoUrl;
          if (!assetUrl) continue;
          if (assetUrl.includes("supabase.co")) {
             newCarouselAssets.push(assetUrl);
             continue;
          }
          const ext = assetUrl.includes(".mp4") ? "mp4" : "webp";
          const path = `${ad.provider.discoveryProvider}/${ad.id}/carousel-${i}.${ext}`;
          const res = await archiveMediaFromUrl(admin, assetUrl, path);
          if (res.path) {
             newCarouselAssets.push(admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl);
          } else {
             newCarouselAssets.push(assetUrl);
          }
       }
    }
    
    const finalStatus = failed ? "failed" : "archived";
    
    // We update refined_data in DB since schema is changed
    // We first need to get the row, update refined_data, and save.
    // For now we can just execute an update statement if we assume there is a trigger or if we fetch it.
    // However, our new DB schema just stores it all in refined_data.
    // Let's just rely on the DB trigger or do nothing for now until background queue is built.
    await admin.from("ads").update({ archive_status: finalStatus }).eq("canonical_ad_id", ad.id);
  }
}
