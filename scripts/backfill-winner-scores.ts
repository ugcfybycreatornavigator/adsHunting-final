import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { calculateWinnerScore } from "../lib/intelligence";
import { normalizedToDb } from "../lib/catalog";
import type { NormalizedAd } from "../lib/types";

async function run() {
  const admin = createAdminClient();
  console.log("Starting Winner Score backfill...");

  let processedAds = 0;
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  // We fetch advertiser IDs first
  const { data: advertisers, error: advError } = await admin
    .from("ads")
    .select("advertiser_id");
    
  if (advError) {
    console.error("Failed to fetch advertisers:", advError);
    process.exit(1);
  }

  const uniqueAdvertiserIds = Array.from(new Set(advertisers.map(a => a.advertiser_id).filter(id => id && id !== "unknown")));
  console.log(`Found ${uniqueAdvertiserIds.length} unique advertisers. Processing...`);

  for (const advId of uniqueAdvertiserIds) {
    console.log(`Processing advertiser: ${advId}`);
    const { data: dbAds, error } = await admin
      .from("ads")
      .select("*")
      .eq("advertiser_id", advId);
      
    if (error || !dbAds || dbAds.length === 0) {
      console.error(`Skipping ${advId} due to error or no ads`);
      continue;
    }

    const contextAds: NormalizedAd[] = [];
    for (const row of dbAds) {
      processedAds++;
      if (row.refined_data) {
        contextAds.push(row.refined_data as unknown as NormalizedAd);
      } else {
        skipCount++;
      }
    }

    if (contextAds.length === 0) continue;

    const adsToUpsert = [];
    for (const ad of contextAds) {
      try {
        const score = calculateWinnerScore(ad, { advertiserAds: contextAds });
        ad.intelligence.winnerScore = score;
        adsToUpsert.push(normalizedToDb(ad));
        successCount++;
      } catch (e) {
        console.error(`Failed to calculate score for ad ${ad.id}:`, e);
        failCount++;
      }
    }

    if (adsToUpsert.length > 0) {
      // Chunk upserts
      const chunkSize = 500;
      for (let i = 0; i < adsToUpsert.length; i += chunkSize) {
        const chunk = adsToUpsert.slice(i, i + chunkSize);
        const { error: upsertError } = await admin.from("ads").upsert(chunk, { 
          onConflict: "canonical_ad_id",
          ignoreDuplicates: false 
        });
        if (upsertError) {
          console.error(`Upsert failed for chunk in advertiser ${advId}:`, upsertError);
        }
      }
    }
  }

  console.log("=== Backfill Complete ===");
  console.log(`Total ads processed: ${processedAds}`);
  console.log(`Successfully scored: ${successCount}`);
  console.log(`Skipped (missing refined_data): ${skipCount}`);
  console.log(`Failed to score: ${failCount}`);
}

run().catch(console.error);
