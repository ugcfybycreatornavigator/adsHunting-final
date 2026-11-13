import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";
import { hashShareToken } from "@/lib/shared-ads";

export async function GET() {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: links, error } = await auth.supabase
    .from("shared_ad_links")
    .select(`
      id, owner_user_id, name, message, token_hash, content_type, swipe_file_id, 
      expires_at, revoked_at, visibility, allow_save, allow_download, created_at, updated_at, last_viewed_at,
      items:shared_ad_items(count),
      views:shared_ad_access_events(count)
    `)
    .eq("owner_user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[SharedAds] GET failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json({ error: error.message || "Failed to load shared ads." }, { status: 500 });
  }

  const formattedLinks = links.map(link => {
    let status = "active";
    if (link.revoked_at) {
      status = "disabled";
    } else if (link.expires_at && new Date(link.expires_at) < new Date()) {
      status = "expired";
    }
    
    return {
      id: link.id,
      ownerUserId: link.owner_user_id,
      name: link.name,
      message: link.message,
      tokenHash: link.token_hash,
      contentType: link.content_type,
      swipeFileId: link.swipe_file_id,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
      visibility: link.visibility || "private",
      allowSave: link.allow_save,
      allowDownload: link.allow_download,
      createdAt: link.created_at,
      updatedAt: link.updated_at,
      lastViewedAt: link.last_viewed_at,
      status,
      views: link.views?.[0]?.count || 0,
      itemCount: link.items?.[0]?.count || 0
    };
  });

  return NextResponse.json({ links: formattedLinks });
}

export async function POST(request: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { name, message, swipeFileId, expiresAt, allowSave, allowDownload, adIds } = body;
  const visibility = body.visibility === "public" ? "public" : "private";

  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    return NextResponse.json({ error: "INVALID_SHARE", message: "A valid share name is required." }, { status: 400 });
  }
  let resolvedAdIds: string[] = [];
  if (swipeFileId) {
    const { data: ownedFile } = await auth.supabase.from("swipe_files").select("id")
      .eq("id", swipeFileId).eq("user_id", auth.userId).maybeSingle();
    if (!ownedFile) return NextResponse.json({ error: "SWIPE_FILE_NOT_FOUND", message: "Swipe File not found." }, { status: 404 });

    const { data: fileItems, error: fileItemsError } = await auth.supabase
      .from("swipe_file_items")
      .select("ad_id")
      .eq("swipe_file_id", swipeFileId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (fileItemsError) {
      return NextResponse.json({ error: "SHARE_ITEMS_FAILED", message: "Couldn't load this Swipe File." }, { status: 500 });
    }
    resolvedAdIds = [...new Set((fileItems || []).map((item) => item.ad_id).filter(Boolean))];
    if (!resolvedAdIds.length) {
      return NextResponse.json({ error: "EMPTY_SWIPE_FILE", message: "Add at least one ad before sharing this Swipe File." }, { status: 400 });
    }
  }

  const requestedAdIds = Array.isArray(adIds)
    ? [...new Set(adIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 100)
    : [];
  if (!swipeFileId && !requestedAdIds.length) {
    return NextResponse.json({ error: "ADS_REQUIRED", message: "Select at least one ad to share." }, { status: 400 });
  }
  if (!swipeFileId && requestedAdIds.length) {
    const uuidIds = requestedAdIds.filter(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id));
    const [byInternal, byCanonical, byExternal] = await Promise.all([
      uuidIds.length ? auth.supabase.from("ads").select("id").in("id", uuidIds) : Promise.resolve({ data: [] }),
      auth.supabase.from("ads").select("id").in("canonical_ad_id", requestedAdIds),
      auth.supabase.from("ads").select("id").in("external_ad_id", requestedAdIds),
    ]);
    resolvedAdIds = [...new Set([
      ...(byInternal.data || []), ...(byCanonical.data || []), ...(byExternal.data || []),
    ].map(row => row.id))];
    if (resolvedAdIds.length !== requestedAdIds.length) {
      return NextResponse.json({ error: "ADS_NOT_FOUND", message: "The selected ads are not available to share." }, { status: 404 });
    }
  }
  const contentType = swipeFileId ? "swipe_file" : resolvedAdIds.length > 1 ? "multiple" : "single";

  const token = "rlt_" + crypto.randomBytes(32).toString("hex");
  const tokenHash = hashShareToken(token);

  const { data: link, error } = await auth.supabase
    .from("shared_ad_links")
    .insert({
      owner_user_id: auth.userId,
      name: name.trim(),
      message,
      token_hash: tokenHash,
      content_type: contentType,
      swipe_file_id: swipeFileId,
      expires_at: expiresAt,
      allow_save: allowSave,
      allow_download: allowDownload,
      visibility: visibility || "private"
    })
    .select()
    .single();

  if (error) {
    console.error("[SharedAds] POST failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json({ error: "SHARE_CREATE_FAILED", message: error.message || "Couldn't create share." }, { status: 500 });
  }

  if (resolvedAdIds.length > 0) {
    const items = resolvedAdIds.map((adId: string, index: number) => ({
      shared_link_id: link.id,
      ad_id: adId,
      position: index
    }));
    const { error: itemsError } = await auth.supabase.from("shared_ad_items").insert(items);
    if (itemsError) {
      console.error("[SharedAds] POST items failed", {
        message: itemsError?.message,
        code: itemsError?.code,
        details: itemsError?.details,
        hint: itemsError?.hint,
      });
      await auth.supabase.from("shared_ad_links").delete().eq("id", link.id).eq("owner_user_id", auth.userId);
      return NextResponse.json({ error: "SHARE_ITEMS_FAILED", message: "Couldn't attach the selected ads to this share." }, { status: 500 });
    }
  }

  return NextResponse.json({ link, token });
}
