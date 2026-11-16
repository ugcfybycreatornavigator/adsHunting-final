import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { classifyAdCategory, isValidCuratedCategory } from "../lib/category-classifier";

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

async function runEnrichment() {
  const applyChanges = process.argv.includes("--apply");
  const maxRowsArg = process.argv.find((arg) => arg.startsWith("--max-rows="));
  const maxRows = Math.min(Math.max(Number(maxRowsArg?.split("=")[1] || 500), 1), 5_000);
  console.log(`${applyChanges ? "Applying" : "Auditing"} deterministic category enrichment (max ${maxRows} rows)...`);

  const startTime = Date.now();
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalWouldUpdate = 0;
  let totalClassified = 0;
  let totalCuratedPreserved = 0;
  let totalUnknown = 0;
  const categoryCounts: Record<string, number> = {};

  const BATCH_SIZE = 100;
  let page = 0;

  while (totalProcessed < maxRows) {
    const rangeStart = page * BATCH_SIZE;
    const rangeEnd = Math.min(rangeStart + BATCH_SIZE - 1, maxRows - 1);

    const { data: rows, error } = await supabase
      .from("ads")
      .select("id, canonical_ad_id, advertiser_name, headline, body, landing_page_url, refined_data")
      .order("id", { ascending: true })
      .range(rangeStart, rangeEnd);

    if (error) {
      console.error(`Error fetching batch at range [${rangeStart}, ${rangeEnd}]:`, error);
      break;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    const updates: Array<{ id: string; refined_data: Record<string, unknown> }> = [];

    for (const row of rows) {
      totalProcessed++;
      const refined = (row.refined_data && typeof row.refined_data === "object") ? { ...row.refined_data } : {};
      const existingIntelligence = (refined.intelligence && typeof refined.intelligence === "object") ? { ...refined.intelligence } : {};
      const existingCat = existingIntelligence.category;

      if (typeof existingCat === "string" && isValidCuratedCategory(existingCat)) {
        totalCuratedPreserved++;
        totalClassified++;
        categoryCounts[existingCat] = (categoryCounts[existingCat] || 0) + 1;
        continue;
      }

      const classified = classifyAdCategory({
        advertiserName: row.advertiser_name,
        headline: row.headline,
        body: row.body,
        landingPageUrl: row.landing_page_url,
        existingCategory: existingCat,
      });

      if (classified.category !== "Unknown") {
        totalClassified++;
        categoryCounts[classified.category] = (categoryCounts[classified.category] || 0) + 1;
      } else {
        totalUnknown++;
      }

      const targetCategory = classified.category === "Unknown" ? null : classified.category;
      const targetNicheId = classified.nicheId === "unknown" ? null : classified.nicheId;

      if (
        existingCat !== targetCategory ||
        existingIntelligence.categoryProvenance !== classified.provenance ||
        existingIntelligence.nicheId !== targetNicheId
      ) {
        const updatedIntelligence = {
          ...existingIntelligence,
          category: targetCategory,
          nicheId: targetNicheId,
          categoryProvenance: classified.provenance,
          categoryConfidence: classified.confidence,
          labels: targetCategory && !(existingIntelligence.labels || []).includes(targetCategory)
            ? [...(existingIntelligence.labels || []), targetCategory]
            : (existingIntelligence.labels || []),
        };

        const updatedRefinedData = {
          ...refined,
          id: row.canonical_ad_id || row.id,
          intelligence: updatedIntelligence,
        };

        updates.push({
          id: row.id,
          refined_data: updatedRefinedData,
        });
      }
    }

    if (applyChanges && updates.length > 0) {
      // Execute in parallel batches of 10 for performance
      const CHUNK = 10;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const slice = updates.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (update) => {
            const { error: updateErr } = await supabase
              .from("ads")
              .update({
                refined_data: update.refined_data,
              })
              .eq("id", update.id);

            if (updateErr) {
              console.error(`Failed to update ad ${update.id}:`, updateErr.message);
            } else {
              totalUpdated++;
            }
          })
        );
      }
    }

    totalWouldUpdate += updates.length;

    page++;
    process.stdout.write(`\rProcessed ${totalProcessed} ads | ${applyChanges ? "Updated" : "Would update"} ${applyChanges ? totalUpdated : totalWouldUpdate} records...`);

    if (rows.length < BATCH_SIZE) {
      break;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n\n=== ENRICHMENT SUMMARY ===");
  console.log(`Total ads processed: ${totalProcessed}`);
  console.log(`${applyChanges ? "Records updated" : "Dry-run mode; records updated"}: ${totalUpdated}`);
  if (!applyChanges) console.log(`Records eligible for update: ${totalWouldUpdate}`);
  console.log(`Curated classifications preserved: ${totalCuratedPreserved}`);
  const denominator = Math.max(totalProcessed, 1);
  console.log(`Total high-confidence classifications: ${totalClassified} (${((totalClassified / denominator) * 100).toFixed(2)}%)`);
  console.log(`Honest Unknown classifications: ${totalUnknown} (${((totalUnknown / denominator) * 100).toFixed(2)}%)`);
  console.log(`Duration: ${durationSec}s`);
  console.log("\nCategory Distribution:");
  console.table(Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]));
}

runEnrichment();
