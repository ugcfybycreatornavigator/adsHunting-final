import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";

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

  const body = await request.json();
  const { name, message, contentType, swipeFileId, expiresAt, allowSave, allowDownload, adIds, visibility } = body;

  const token = "rlt_" + crypto.randomBytes(32).toString("hex");

  const { data: link, error } = await auth.supabase
    .from("shared_ad_links")
    .insert({
      owner_user_id: auth.userId,
      name,
      message,
      token_hash: token,
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

  if (adIds && adIds.length > 0) {
    const items = adIds.map((adId: string, index: number) => ({
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
    }
  }

  return NextResponse.json({ link, token });
}
