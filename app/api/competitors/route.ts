import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncCompetitorAds } from "@/lib/brand-data";

function competitorResponse(body: unknown, requestId: string, startedAt: number, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("Server-Timing", `total;dur=${Math.round(performance.now() - startedAt)}`);
  return NextResponse.json({ ...(body as Record<string, unknown>), requestId }, { ...init, headers });
}

export async function GET() {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const { data, error } = await auth.supabase!.from("competitors").select("*").eq("user_id", auth.user!.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const competitors = data ?? [];
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  const staleSyncing = competitors.filter(c => c.sync_status === "syncing" && c.sync_started_at && new Date(c.sync_started_at).getTime() < twoMinutesAgo);

  if (staleSyncing.length > 0) {
    const staleIds = staleSyncing.map(c => c.id);
    await auth.supabase!
      .from("competitors")
      .update({
        sync_status: "error",
        sync_error: "Sync timed out. Please retry.",
        sync_started_at: null
      })
      .in("id", staleIds);

    for (const comp of staleSyncing) {
      comp.sync_status = "error";
      comp.sync_error = "Sync timed out. Please retry.";
      comp.sync_started_at = null;
    }
  }

  return NextResponse.json({ competitors });
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
      sync_started_at: new Date().toISOString(),
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
      .maybeSingle();
    
    // Update sync status to success
    await auth.supabase!
      .from("competitors")
      .update({
        sync_status: "success",
        sync_error: null,
        sync_started_at: null,
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
          sync_started_at: null
        })
        .eq("id", competitor.id);
    } catch (updateErr) {
      console.error(`[CompetitorSync] Failed to update error status:`, updateErr);
    }
    
    return NextResponse.json({ 
      competitor: { ...competitor, sync_status: "error" },
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
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;
  
  const parsed = z.object({
    id: z.string().uuid(),
    action: z.enum(["refresh", "pause", "resume"]),
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) {
    return competitorResponse({ error: "Invalid action." }, requestId, startedAt, { status: 400 });
  }
  
  const { id, action } = parsed.data;
  
  // Verify ownership
  const { data: competitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user!.id)
    .maybeSingle();
  
  if (!competitor) {
    return competitorResponse({ error: "Competitor not found." }, requestId, startedAt, { status: 404 });
  }
  
  if (action === "pause") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "paused" })
      .eq("id", id);
    return competitorResponse({ ok: true, status: "paused" }, requestId, startedAt);
  }
  
  if (action === "resume") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "tracking" })
      .eq("id", id);
    return competitorResponse({ ok: true, status: "tracking" }, requestId, startedAt);
  }
  
  if (action === "refresh") {
    // Prevent concurrent syncs unless previous sync timed out (> 2 minutes)
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const isStale = competitor.sync_status === "syncing" && competitor.sync_started_at && new Date(competitor.sync_started_at).getTime() < twoMinutesAgo;

    if (competitor.sync_status === "syncing" && !isStale) {
      return competitorResponse({ error: "Sync already in progress." }, requestId, startedAt, { status: 409 });
    }
    
    await auth.supabase!
      .from("competitors")
      .update({ sync_status: "syncing", sync_error: null, sync_started_at: new Date().toISOString() })
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
          sync_started_at: null,
          ads_count: adsCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      return competitorResponse({ ok: true, adsCount, syncStatus: "success" }, requestId, startedAt);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Refresh failed.";
      await auth.supabase!
        .from("competitors")
        .update({ sync_status: "error", sync_error: errMsg, sync_started_at: null })
        .eq("id", id);
      return competitorResponse({ error: errMsg }, requestId, startedAt, { status: 502 });
    }
  }
  
  return competitorResponse({ error: "Unknown action." }, requestId, startedAt, { status: 400 });
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
