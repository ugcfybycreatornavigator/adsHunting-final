import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dbAdToNormalized } from "@/lib/catalog";
import { adsForClient } from "@/lib/ads-persistence";

export async function GET(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

  const { searchParams } = new URL(req.url);
  const swipeFileId = searchParams.get("swipeFileId");

  let query = auth.supabase!
    .from("swipe_file_items")
    .select("id, notes, created_at, swipe_file_id, ads (*), swipe_files!inner(user_id)")
    .eq("swipe_files.user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (swipeFileId) {
    query = query.eq("swipe_file_id", swipeFileId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const adMap = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const item of data) {
    const ad = Array.isArray(item.ads) ? item.ads[0] : item.ads;
    if (!ad) continue;
    const adId = ad.id;
    if (!adMap.has(adId)) {
      adMap.set(adId, {
        id: item.id,
        ad: dbAdToNormalized(ad as any /* eslint-disable-line @typescript-eslint/no-explicit-any */),
        notes: item.notes,
        tags: [],
        collectionIds: [item.swipe_file_id]
      });
    } else {
      adMap.get(adId).collectionIds.push(item.swipe_file_id);
      if (item.notes) adMap.get(adId).notes = item.notes;
    }
  }

  let items = Array.from(adMap.values());

  items = items.map(item => ({ ...item, ad: adsForClient([item.ad])[0] }));

  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id, notes } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const { error } = await auth.supabase!
    .from("swipe_file_items")
    .update({ notes })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id"); 

  const { error } = await auth.supabase!.from("swipe_file_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
