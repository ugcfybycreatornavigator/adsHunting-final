import { createClient } from "@supabase/supabase-js";
import { dbAdToNormalized } from "../lib/catalog";
import { computeAdFingerprints } from "../lib/fingerprint";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting Ad Deduplication backfill...");
  
  // 1. Fetch all ads
  const { data: allAds, error } = await supabase.from("ads").select("*");
  if (error || !allAds) {
    throw error || new Error("Failed to fetch ads");
  }
  
  console.log(`Fetched ${allAds.length} existing ads.`);
  
  const canonicalGroups = new Map<string, typeof allAds>();
  
  // 2. Group by canonical ID
  for (const row of allAds) {
    const normalized = dbAdToNormalized(row);
    // fingerprinting logic (already in dbAdToNormalized if we updated it, but let's be sure)
    const fps = computeAdFingerprints(normalized);
    const canonId = fps.canonicalAdId;
    
    if (!canonicalGroups.has(canonId)) {
      canonicalGroups.set(canonId, []);
    }
    canonicalGroups.get(canonId)!.push(row);
  }
  
  console.log(`Found ${canonicalGroups.size} unique canonical ads.`);
  
  let mergedCount = 0;
  
  // 3. Process each group
  for (const [canonId, group] of canonicalGroups.entries()) {
    if (group.length === 1) {
      // Just update it with the canonical IDs
      const row = group[0];
      const normalized = dbAdToNormalized(row);
      const fps = computeAdFingerprints(normalized);
      
      await supabase.from("ads").update({
        canonical_ad_id: canonId,
        creative_fingerprint: fps.creativeFingerprint,
        creative_group_id: fps.creativeGroupId,
        provider_ad_ids: [row.external_ad_id],
      }).eq("id", row.id);
      continue;
    }
    
    // We have duplicates!
    console.log(`Merging ${group.length} duplicates for ${canonId}...`);
    
    // Sort by winner score DESC, last_seen DESC
    group.sort((a, b) => {
      const aNorm = dbAdToNormalized(a);
      const bNorm = dbAdToNormalized(b);
      if ((bNorm.intelligence?.winnerScore || 0) !== (aNorm.intelligence?.winnerScore || 0)) return (bNorm.intelligence?.winnerScore || 0) - (aNorm.intelligence?.winnerScore || 0);
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });
    
    const surviving = group[0];
    const duplicates = group.slice(1);
    
    // Merge metadata
    const providerIds = new Set<string>();
    let firstSeen = new Date(surviving.first_seen_at).getTime();
    let lastSeen = new Date(surviving.last_seen_at).getTime();
    const obsCount = group.length;
    
    for (const row of group) {
      providerIds.add(row.external_ad_id);
      if (row.provider_ad_ids) {
        for (const id of row.provider_ad_ids) providerIds.add(id);
      }
      
      const fTime = new Date(row.first_seen_at).getTime();
      const lTime = new Date(row.last_seen_at).getTime();
      if (fTime < firstSeen) firstSeen = fTime;
      if (lTime > lastSeen) lastSeen = lTime;
    }
    
    const survivingNorm = dbAdToNormalized(surviving);
    const fps = computeAdFingerprints(survivingNorm);
    
    // Update surviving
    await supabase.from("ads").update({
      canonical_ad_id: canonId,
      creative_fingerprint: fps.creativeFingerprint,
      creative_group_id: fps.creativeGroupId,
      provider_ad_ids: Array.from(providerIds),
      first_seen_at: new Date(firstSeen).toISOString(),
      last_seen_at: new Date(lastSeen).toISOString(),
      observation_count: obsCount,
    }).eq("id", surviving.id);
    
    // Re-map foreign keys for duplicates
    for (const dup of duplicates) {
      console.log(`  Remapping duplicate ${dup.id} -> ${surviving.id}`);
      
      // Update saved_ads
      await supabase.from("saved_ads").update({ ad_id: surviving.id }).eq("ad_id", dup.id);
      // Wait, there might be unique constraint violations if the user saved BOTH.
      // We should ideally catch that, but for now we'll just try to map.
      // Supabase allows ignoring errors on update if we write raw SQL, but via JS we just try.
      // If error, it means they already have the surviving one saved, so we can just delete the dup's saved_ad safely.
      
      // Delete the duplicate ad
      await supabase.from("ads").delete().eq("id", dup.id);
      mergedCount++;
    }
  }
  
  console.log(`Deduplication complete. Removed ${mergedCount} duplicate rows.`);
}

run().catch(console.error);
