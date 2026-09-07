import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbAdToNormalized } from "@/lib/catalog";
import { adsForClient } from "@/lib/ads-persistence";
import { signArchivedAdMedia } from "@/lib/media-access";

export async function GET(req: NextRequest) {
  try {
    const accessError = await requirePaidWorkspaceAccess();
    if (accessError) return accessError;

    const auth = await requireUser();
    if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

    const { searchParams } = new URL(req.url);
    const swipeFileId = searchParams.get("swipeFileId");

    // 1. Fetch the primary items and ad data
    let query = auth.supabase!
      .from("swipe_file_items")
      .select("id, notes, created_at, swipe_file_id, ads (*), swipe_files!inner(user_id)")
      .eq("swipe_files.user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (swipeFileId) {
      query = query.eq("swipe_file_id", swipeFileId);
    }

    const { data: primaryItems, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!primaryItems || primaryItems.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Extract unique ad_ids from the primary fetch
    const adIds = new Set<string>();
    for (const item of primaryItems) {
      const ad = Array.isArray(item.ads) ? item.ads[0] : item.ads;
      if (ad?.id) adIds.add(ad.id);
    }

    // 2. Fetch lightweight memberships for these specific ads across all user folders
    const { data: membershipData, error: membershipError } = await auth.supabase!
      .from("swipe_file_items")
      .select("ad_id, swipe_file_id, swipe_files!inner(user_id)")
      .eq("swipe_files.user_id", auth.userId)
      .in("ad_id", Array.from(adIds));

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

    const membershipsByAd = new Map<string, string[]>();
    for (const row of membershipData || []) {
      if (!membershipsByAd.has(row.ad_id)) membershipsByAd.set(row.ad_id, []);
      membershipsByAd.get(row.ad_id)!.push(row.swipe_file_id);
    }

    // 3. Assemble and normalize the response payload
    const adMap = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const item of primaryItems) {
      const ad = Array.isArray(item.ads) ? item.ads[0] : item.ads;
      if (!ad) continue;
      const adId = ad.id;

      if (!adMap.has(adId)) {
        let normalizedAd;
        try {
          normalizedAd = dbAdToNormalized(ad as any /* eslint-disable-line @typescript-eslint/no-explicit-any */);
        } catch (err) {
          console.error(`[SavedAds] Failed to normalize ad ${adId}:`, err);
          continue; // Safely isolate corrupted DB row
        }
        
        adMap.set(adId, {
          id: item.id, // primary item id
          ad: normalizedAd,
          notes: item.notes,
          tags: [],
          collectionIds: membershipsByAd.get(adId) || [item.swipe_file_id]
        });
      } else {
        // Since we order by created_at desc, we might want to keep the newest notes
        if (item.notes) adMap.get(adId).notes = item.notes;
      }
    }

    let items = Array.from(adMap.values());

    // 4. Sign media URLs
    const signedAds = await signArchivedAdMedia(items.map(item => adsForClient([item.ad])[0]));
    items = items.map((item, index) => ({ ...item, ad: signedAds[index] }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[SavedAds] Unexpected error in GET /api/swipe-files/ads:", err);
    return NextResponse.json({ error: "Failed to load saved ads." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const accessError = await requirePaidWorkspaceAccess();
    if (accessError) return accessError;

    const auth = await requireUser();
    if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

    const body = await req.json().catch(() => ({}));
    const { notes, adId, collectionIds } = body;
    const itemId = body.itemId || body.id; // Fallback to id for backward compatibility

    // 1. Handle Notes update (requires itemId)
    if (itemId && typeof notes === "string") {
      const { data: verifyItem, error: verifyError } = await auth.supabase!
        .from("swipe_file_items")
        .select("id, swipe_files!inner(user_id)")
        .eq("id", itemId)
        .eq("swipe_files.user_id", auth.userId)
        .maybeSingle();

      if (verifyError || !verifyItem) return NextResponse.json({ error: "Item not found or unauthorized" }, { status: 404 });

      const { error } = await auth.supabase!
        .from("swipe_file_items")
        .update({ notes })
        .eq("id", itemId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // 2. Handle Collection Memberships update (requires adId and collectionIds array)
    if (adId && Array.isArray(collectionIds)) {
      // Verify all submitted collectionIds belong to this user
      if (collectionIds.length > 0) {
        const { data: userFiles, error: userFilesError } = await auth.supabase!
          .from("swipe_files")
          .select("id")
          .eq("user_id", auth.userId)
          .in("id", collectionIds);
        
        if (userFilesError) return NextResponse.json({ error: userFilesError.message }, { status: 500 });
        if (userFiles?.length !== collectionIds.length) {
          return NextResponse.json({ error: "Invalid collection IDs provided." }, { status: 403 });
        }
      }

      // Fetch existing memberships for this ad for this user
      const { data: existingItems, error: existingError } = await auth.supabase!
        .from("swipe_file_items")
        .select("id, swipe_file_id, swipe_files!inner(user_id)")
        .eq("ad_id", adId)
        .eq("swipe_files.user_id", auth.userId);

      if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

      const existingSet = new Set(existingItems?.map(item => item.swipe_file_id) || []);
      const requestedSet = new Set(collectionIds);

      const toAdd = collectionIds.filter(id => !existingSet.has(id));
      const toRemove = existingItems?.filter(item => !requestedSet.has(item.swipe_file_id)).map(item => item.id) || [];

      // Execute diff transactionally
      if (toRemove.length > 0) {
        const { error: deleteError } = await auth.supabase!
          .from("swipe_file_items")
          .delete()
          .in("id", toRemove);
        if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (toAdd.length > 0) {
        const inserts = toAdd.map(fileId => ({
          swipe_file_id: fileId,
          ad_id: adId,
        }));
        const { error: insertError } = await auth.supabase!
          .from("swipe_file_items")
          .upsert(inserts, { onConflict: "swipe_file_id,ad_id", ignoreDuplicates: true });
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  } catch (err) {
    console.error("[SavedAds] Unexpected error in PATCH /api/swipe-files/ads:", err);
    return NextResponse.json({ error: "Failed to update saved ad." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const accessError = await requirePaidWorkspaceAccess();
    if (accessError) return accessError;

    const auth = await requireUser();
    if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id"); 
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { data: verify, error: verifyError } = await auth.supabase!
      .from("swipe_file_items")
      .select("id, swipe_files!inner(user_id)")
      .eq("id", id)
      .eq("swipe_files.user_id", auth.userId)
      .maybeSingle();
      
    if (verifyError || !verify) return NextResponse.json({ error: "Item not found or unauthorized" }, { status: 404 });

    const { error } = await auth.supabase!.from("swipe_file_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SavedAds] Unexpected error in DELETE /api/swipe-files/ads:", err);
    return NextResponse.json({ error: "Failed to remove saved ad." }, { status: 500 });
  }
}
