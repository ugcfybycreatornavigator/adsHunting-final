import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncCompetitorAds } from "@/lib/brand-data";

export async function GET() {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const { data, error } = await auth.supabase!.from("competitors").select("*").eq("user_id", auth.user!.id).order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ competitors: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(); 
  if (auth.error) return auth.error;
  
  const accessError = await requirePaidWorkspaceAccess(); 
  if (accessError) return accessError;
  
  const parsed = z.object({ 
    advertiserId: z.string().min(1).max(200), 
    advertiserName: z.string().min(1).max(300), 
    advertiserAvatarUrl: z.string().nullable().optional() 
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) 
    return NextResponse.json({ error: "Select a valid advertiser." }, { status: 400 });
  
  // Check if already tracking
  const { data: existingCompetitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .eq("advertiser_id", parsed.data.advertiserId)
    .maybeSingle();
  
  if (existingCompetitor) {
    return NextResponse.json({ 
      competitor: existingCompetitor,
      isNew: false,
      message: "Already tracking this advertiser."
    }, { status: 200 });
  }

  // Create competitor record with sync_status = "syncing"
  const { data: competitor, error: createError } = await auth.supabase!
    .from("competitors")
    .insert({
      user_id: auth.user!.id,
      advertiser_id: parsed.data.advertiserId,
      advertiser_name: parsed.data.advertiserName,
      advertiser_avatar_url: parsed.data.advertiserAvatarUrl,
      sync_status: "syncing",
      ads_count: -1
    })
    .select()
    .single();
  
  if (createError) 
    return NextResponse.json({ error: createError.message }, { status: 400 });
  
  // Initiate sync and AWAIT completion
  let syncError: string | null = null;
  let adsCount = 0;
  
  try {
    const persisted = await syncCompetitorAds(parsed.data.advertiserId);
    
    // Query how many ads we actually have now (provider may have returned ads that already existed)
    const { count } = await auth.supabase!
      .from("ads")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", parsed.data.advertiserId);
    
    adsCount = count ?? persisted;
    
    // Re-fetch the competitor record to get the updated name/avatar from syncCompetitorAds
    const { data: updatedCompetitor } = await auth.supabase!
      .from("competitors")
      .select("*")
      .eq("id", competitor.id)
      .single();
    
    // Update sync status to success
    await auth.supabase!
      .from("competitors")
      .update({
        sync_status: "success",
        sync_error: null,
        ads_count: adsCount,
        first_sync_completed_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", competitor.id);
    
    return NextResponse.json({ 
      competitor: { 
        ...(updatedCompetitor || competitor), 
        sync_status: "success",
        ads_count: adsCount
      },
      isNew: true,
      syncStatus: "success",
      adsCount,
      syncError: null
    }, { status: 201 });
    
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Sync failed.";
    console.error(`[CompetitorSync] POST error for ${parsed.data.advertiserId}:`, err);
    
    // Mark as error
    try {
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "error",
          sync_error: syncError,
          ads_count: 0
        })
        .eq("id", competitor.id);
    } catch (updateErr) {
      console.error(`[CompetitorSync] Failed to update error status:`, updateErr);
    }
    
    return NextResponse.json({ 
      competitor: { ...competitor, sync_status: "error", ads_count: 0 },
      isNew: true,
      syncStatus: "error",
      adsCount: 0,
      syncError
    }, { status: 201 });
  }
}

/**
 * PATCH — Competitor actions: refresh, pause, resume
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;
  
  const parsed = z.object({
    id: z.string().uuid(),
    action: z.enum(["refresh", "pause", "resume"]),
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  
  const { id, action } = parsed.data;
  
  // Verify ownership
  const { data: competitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user!.id)
    .single();
  
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }
  
  if (action === "pause") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "paused" })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "paused" });
  }
  
  if (action === "resume") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "tracking" })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "tracking" });
  }
  
  if (action === "refresh") {
    // Prevent concurrent syncs
    if (competitor.sync_status === "syncing") {
      return NextResponse.json({ error: "Sync already in progress." }, { status: 409 });
    }
    
    await auth.supabase!
      .from("competitors")
      .update({ sync_status: "syncing" })
      .eq("id", id);
    
    try {
      const persisted = await syncCompetitorAds(competitor.advertiser_id);
      
      const { count } = await auth.supabase!
        .from("ads")
        .select("*", { count: "exact", head: true })
        .eq("advertiser_id", competitor.advertiser_id);
      
      const adsCount = count ?? Math.max(0, persisted);
      
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "success",
          sync_error: null,
          ads_count: adsCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      return NextResponse.json({ ok: true, adsCount, syncStatus: "success" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Refresh failed.";
      await auth.supabase!
        .from("competitors")
        .update({ sync_status: "error", sync_error: errMsg })
        .eq("id", id);
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }
  }
  
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const id = new URL(request.url).searchParams.get("id");
  const advertiserId = new URL(request.url).searchParams.get("advertiser_id");

  let query = auth.supabase!.from("competitors").delete().eq("user_id", auth.user!.id);
  if (advertiserId) {
    query = query.eq("advertiser_id", advertiserId);
  } else if (id) {
    query = query.eq("id", id);
  } else {
    return NextResponse.json({ error: "Missing id or advertiser_id" }, { status: 400 });
  }

  const { error } = await query;
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
