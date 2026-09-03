import { createAdminClient } from "./supabase/admin";
import { archiveMediaFromUrl } from "./media-archiver";
import { normalizeSearchApiAd } from "./providers/searchapi";

export async function processArchiveBatch() {
  const supabase = createAdminClient();
  
  // Fetch ads that are not yet archived
  const { data: ads } = await supabase
    .from("ads")
    .select("id, advertiser_name, raw_data, source, source_media_url, thumbnail_url, carousel_assets, media_type")
    .neq("archive_status", "archived")
    .limit(50);
    
  if (!ads || ads.length === 0) return 0;
  
  let archivedCount = 0;
  
  // Get public URL prefix for ad-creatives bucket
  
  
  for (const ad of ads) {
    if (ad.source !== "searchapi" || !ad.raw_data) {
       await supabase.from("ads").update({ archive_status: "failed" }).eq("id", ad.id);
       continue;
    }
    
    // We get the external URLs from the normalizer (or the DB if they are already there)
    const norm = normalizeSearchApiAd(ad.raw_data);
    let newSourceUrl = norm.creative.videoUrl || norm.creative.imageUrl;
    let newThumbnailUrl = norm.creative.thumbnailUrl;
    const newCarouselAssets: string[] = [];
    
    let failed = false;
    
    // Archive source media if external
    if (newSourceUrl && !newSourceUrl.includes("supabase.co")) {
      const ext = newSourceUrl.includes(".mp4") ? "mp4" : "webp";
      const path = `searchapi/${ad.id}/source.${ext}`;
      const res = await archiveMediaFromUrl(supabase, newSourceUrl, path);
      if (res.path) {
         newSourceUrl = supabase.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      } else {
         failed = true;
      }
    }
    
    // Archive thumbnail
    if (newThumbnailUrl && !newThumbnailUrl.includes("supabase.co")) {
      const path = `searchapi/${ad.id}/thumbnail.webp`;
      const res = await archiveMediaFromUrl(supabase, newThumbnailUrl, path);
      if (res.path) {
         newThumbnailUrl = supabase.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      }
    }
    
    // Archive carousel
    if (norm.creative.carouselItems && norm.creative.carouselItems.length > 0) {
       for (let i = 0; i < norm.creative.carouselItems.length; i++) {
          const item = norm.creative.carouselItems[i];
          const assetUrl = item.imageUrl || item.videoUrl;
          if (!assetUrl) continue;
          if (assetUrl.includes("supabase.co")) {
             newCarouselAssets.push(assetUrl);
             continue;
          }
          const ext = assetUrl.includes(".mp4") ? "mp4" : "webp";
          const path = `searchapi/${ad.id}/carousel-${i}.${ext}`;
          const res = await archiveMediaFromUrl(supabase, assetUrl, path);
          if (res.path) {
             newCarouselAssets.push(supabase.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl);
          } else {
             // retain the original so the UI still works or fails gracefully
             newCarouselAssets.push(assetUrl);
          }
       }
    }
    
    // Determine status
    // If we have an image/video/carousel and we failed to archive the primary, it's failed
    const finalStatus = failed ? "failed" : "archived";
    
    await supabase.from("ads").update({
       source_media_url: newSourceUrl,
       thumbnail_url: newThumbnailUrl,
       carousel_assets: newCarouselAssets,
       archive_status: finalStatus
    }).eq("id", ad.id);
    
    if (!failed) archivedCount++;
  }
  
  return archivedCount;
}
