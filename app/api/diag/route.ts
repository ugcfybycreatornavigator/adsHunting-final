import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForeplayProvider } from "@/lib/providers/foreplay";
import { dbAdToNormalized, normalizedToDb } from "@/lib/catalog";
import { persistNormalizedAds } from "@/lib/ads-persistence";

export async function GET() {
  try {
    const brandId = "110186374689636"; // Foxtale
    const supabase = createAdminClient();
    const foreplay = new ForeplayProvider();
    if (!foreplay.isConfigured()) {
       foreplay.apiKey = process.env.SPYGLASS_API_KEY || "sg_live_cUnhbVMy6USgR7XXbpQpekVlbrLwJeLPTcgiRhYuoC0";
    }

    const report: Record<string, any> = {};

    // 1. DB count before
    const { count: dbCountBefore } = await supabase.from("ads").select("*", { count: "exact", head: true }).eq("advertiser_id", brandId);
    report.dbBrandRowsBefore = dbCountBefore;

    // 2. Fetch context
    let brandContext = undefined;
    const { data: comp } = await supabase.from("competitors").select("advertiser_name, advertiser_avatar_url").eq("advertiser_id", brandId).maybeSingle();
    if (comp && comp.advertiser_name) {
      brandContext = { brandName: comp.advertiser_name, logoUrl: comp.advertiser_avatar_url || undefined };
    }

    // 3. Spyglass fetch
    const result = await foreplay.searchAds({ brand: brandId, status: "all" }, brandContext);
    report.providerFetched = result.ads.length;

    // 4. Normalization & Deduplication
    const rawAdIds = new Set(result.ads.map(a => a.externalId));
    report.uniqueRawAdIds = rawAdIds.size;

    const creativeIds = new Set(result.ads.map(a => a.id));
    report.uniqueCreativeFingerprints = creativeIds.size;
    report.normalized = result.ads.length;

    // Simulate dedup map
    const dedupMap = new Map<string, any>();
    for (const ad of result.ads) {
      if (!dedupMap.has(ad.id)) dedupMap.set(ad.id, ad);
    }
    const uniqueAds = Array.from(dedupMap.values());

    const rows = uniqueAds.map(normalizedToDb);
    const validRows = [];
    const invalidRows = [];
    for (const row of rows) {
      if (row.canonical_ad_id && row.advertiser_id && row.raw_data && row.media_type) {
        validRows.push(row);
      } else {
        invalidRows.push(row);
      }
    }
    report.valid = validRows.length;
    report.invalid = invalidRows.length;

    // 5. Persist
    const persistResult = await persistNormalizedAds(uniqueAds);
    report.inserted = persistResult.persisted;
    // Assuming updated is the rest (we don't get exact updated vs inserted back easily, but we know persisted count)
    report.persistedTotal = persistResult.persisted;

    const { count: dbCountAfter } = await supabase.from("ads").select("*", { count: "exact", head: true }).eq("advertiser_id", brandId);
    report.DBTotalForBrand = dbCountAfter;

    // 6. Test initial API query
    let query = supabase.from("ads").select("*").eq("advertiser_id", brandId);
    query = query.order("start_date", { ascending: false, nullsFirst: false });
    query = query.order("canonical_ad_id", { ascending: true });
    query = query.range(0, 24);

    const { data: dbData } = await query;
    report.initialApiReturned = dbData?.length || 0;

    if (dbData && dbData.length > 0) {
      const ads = dbData.map(dbAdToNormalized);
      report.uiRendered = ads.length;
      
      const sampleAds = ads.slice(0, 2);
      report.sampleAdsBrandIdentity = sampleAds.map(ad => ({
         name: ad.advertiser.name,
         logo: ad.advertiser.logoUrl,
         providerBrandId: ad.advertiser.id,
         source: ad.provider.discoveryProvider,
         id: ad.id,
         externalId: ad.externalId
      }));
    }

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
