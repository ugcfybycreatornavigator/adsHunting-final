import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { archiveMediaFromUrl } from "../lib/media-archiver";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function recoverMedia() {
  console.log("Starting bounded media recovery batch for ads with unarchived media...");

  // Select up to 30 ads that have external media URLs but are not yet archived
  const { data: ads, error } = await supabase
    .from("ads")
    .select("id, canonical_ad_id, source, source_media_url, thumbnail_url, media_type, archive_status, refined_data")
    .not("thumbnail_url", "is", null)
    .neq("archive_status", "archived")
    .neq("archive_status", "unavailable")
    .limit(30);

  if (error || !ads || ads.length === 0) {
    console.log("No ads pending media recovery or query returned empty:", error?.message);
    return;
  }

  console.log(`Found ${ads.length} candidate ads for media recovery`);

  let recoveredCount = 0;
  let unavailableCount = 0;
  let alreadyArchivedCount = 0;

  for (const ad of ads) {
    let sourceUrl = ad.source_media_url;
    let thumbUrl = ad.thumbnail_url;
    const provider = ad.source || "ads";
    const adId = ad.canonical_ad_id || ad.id;

    if (
      (sourceUrl && sourceUrl.includes("supabase.co")) ||
      (thumbUrl && thumbUrl.includes("supabase.co"))
    ) {
      alreadyArchivedCount++;
      await supabase.from("ads").update({ archive_status: "archived" }).eq("id", ad.id);
      continue;
    }

    let archivedAny = false;
    let failedToArchive = false;

    // 1. Recover thumbnail
    if (thumbUrl && !thumbUrl.includes("supabase.co")) {
      const storagePath = `${provider}/${adId}/thumbnail.webp`;
      const res = await archiveMediaFromUrl(supabase, thumbUrl, storagePath);
      if (res.path) {
        thumbUrl = supabase.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
        archivedAny = true;
      } else {
        failedToArchive = true;
      }
    }

    // 2. Recover source media (if image)
    if (sourceUrl && !sourceUrl.includes("supabase.co") && ad.media_type !== "video") {
      const storagePath = `${provider}/${adId}/source.webp`;
      const res = await archiveMediaFromUrl(supabase, sourceUrl, storagePath);
      if (res.path) {
        sourceUrl = supabase.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
        archivedAny = true;
      } else {
        failedToArchive = true;
      }
    }

    const finalStatus = archivedAny ? "archived" : (failedToArchive ? "unavailable" : "not_requested");

    const refined = (ad.refined_data && typeof ad.refined_data === "object") ? { ...ad.refined_data } : {};
    const creative = (refined.creative && typeof refined.creative === "object") ? { ...refined.creative } : {};
    const updatedRefined = {
      ...refined,
      creative: {
        ...creative,
        thumbnailUrl: thumbUrl,
        imageUrl: ad.media_type !== "video" ? (sourceUrl || creative.imageUrl) : creative.imageUrl,
      },
      enrichment: {
        ...(refined.enrichment || {}),
        archiveStatus: finalStatus,
      },
    };

    const { error: updateErr } = await supabase
      .from("ads")
      .update({
        thumbnail_url: thumbUrl,
        source_media_url: sourceUrl,
        archive_status: finalStatus,
        refined_data: updatedRefined,
      })
      .eq("id", ad.id);

    if (updateErr) {
      console.error(`Failed to update ad ${ad.id}:`, updateErr.message);
    } else if (finalStatus === "archived") {
      recoveredCount++;
    } else {
      unavailableCount++;
    }
  }

  console.log("\n=== MEDIA RECOVERY SUMMARY ===");
  console.log(`Total candidate ads evaluated: ${ads.length}`);
  console.log(`Successfully recovered and stored in Supabase: ${recoveredCount}`);
  console.log(`Unavailable / expired provider links marked: ${unavailableCount}`);
  console.log(`Already archived ads updated: ${alreadyArchivedCount}`);
}

recoverMedia();
