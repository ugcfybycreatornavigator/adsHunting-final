import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: ads, error } = await supabase
    .from("ads")
    .select("canonical_ad_id, advertiser_id, advertiser_name, raw_data, refined_data")
    .in("advertiser_name", ["Unknown", "Unknown Brand", "Unknown Advertiser", "Unknown advertiser"]);

  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Found ${ads?.length || 0} ads with unknown advertiser name.`);

  if (ads && ads.length > 0) {
    for (const ad of ads) {
      const raw = ad.raw_data as any;
      let newName = null;
      if (raw) {
         if (raw.page_name) newName = raw.page_name;
         else if (raw.name) newName = raw.name;
         else if (raw.brand?.name) newName = raw.brand.name;
         else if (raw.advertiser?.name) newName = raw.advertiser.name;
      }
      
      if (newName && !["Unknown", "Unknown Brand", "Unknown Advertiser"].includes(newName)) {
         console.log(`Fixing ad ${ad.canonical_ad_id}: ${newName}`);
         const refined = ad.refined_data as any;
         if (refined && refined.advertiser) {
            refined.advertiser.name = newName;
         }
         await supabase.from("ads").update({ advertiser_name: newName, refined_data: refined }).eq("canonical_ad_id", ad.canonical_ad_id);
      } else {
         console.log(`Cannot fix ad ${ad.canonical_ad_id}, leaving as empty string`);
         const refined = ad.refined_data as any;
         if (refined && refined.advertiser) {
            refined.advertiser.name = "";
         }
         await supabase.from("ads").update({ advertiser_name: "", refined_data: refined }).eq("canonical_ad_id", ad.canonical_ad_id);
      }
    }
  }

  const { data: comps, error: compErr } = await supabase
    .from("competitors")
    .select("advertiser_id, advertiser_name")
    .in("advertiser_name", ["Unknown", "Unknown Brand", "Unknown Advertiser", "Unknown advertiser"]);
    
  console.log(`Found ${comps?.length || 0} competitors with unknown advertiser name.`);
  
  if (comps && comps.length > 0) {
     for (const comp of comps) {
        console.log(`Setting competitor ${comp.advertiser_id} to empty string`);
        await supabase.from("competitors").update({ advertiser_name: "" }).eq("advertiser_id", comp.advertiser_id);
     }
  }
}

run();
