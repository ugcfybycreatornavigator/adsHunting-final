import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { isSupabaseConfigured } from "@/lib/env";

const usageSchema = z.object({
  searchSessionId: z.string().min(1),
  event: z.enum(["ad_impression", "ad_open"]),
  adIds: z.array(z.string().min(1)).min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ success: true, dummy: true });
  }

  // 1. Authenticate user
  const auth = await requireUser();
  if (auth.error || !auth.user || !auth.supabase) {
    return auth.error || NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { user, supabase } = auth;
  const workspaceId = user.id; // workspace is tied 1:1 to user ID in this architecture

  // 2. Validate entitlement
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) {
    return accessError; // 402 if completely lacking subscription
  }

  // 3. Parse payload
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = usageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { searchSessionId, event, adIds, metadata } = parsed.data;

  // Deduplicate adIds canonically
  const uniqueAdIds = Array.from(new Set(adIds));
  const costPerEvent = event === "ad_open" ? 2 : 1;

  // Platform owner bypass: never block or deduct
  const { isPlatformOwner } = await import("@/lib/platform-owner");
  if (await isPlatformOwner(user.id)) {
    return NextResponse.json({
      success: true,
      creditsCharged: 0,
      creditsRemaining: 999999999,
      acceptedAdIds: uniqueAdIds,
      rejectedAdIds: [],
    });
  }

  // 4. Call RPC securely
  try {
    const { data, error } = await supabase.rpc("report_credit_usage_batch", {
      p_workspace_id: workspaceId,
      p_user_id: user.id,
      p_search_session_id: searchSessionId,
      p_event_type: event,
      p_ad_ids: uniqueAdIds,
      p_cost_per_event: costPerEvent,
      p_metadata: metadata || {}
    });

    if (error) {
      console.error("[Credits API] RPC error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // data contains: success, creditsCharged, creditsRemaining, acceptedAdIds, rejectedAdIds, exhausted, error
    if (!data.success && data.error === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({
        error: "INSUFFICIENT_CREDITS",
        reason: "out_of_credits",
        creditsRemaining: 0,
        acceptedAdIds: data.acceptedAdIds || [],
        rejectedAdIds: data.rejectedAdIds || uniqueAdIds,
        exhausted: true
      }, { status: 402 }); // 402 specifically for out of credits during usage
    }
    
    if (!data.success && data.error === "NO_ACTIVE_CYCLE") {
       // Allow them to continue if they have a legacy grant but no cycle yet, or block?
       // The user requested: "Existing legacy-grace users -> 10,000 credits while grace entitlement is active".
       // For now, if no cycle exists, we can return a fallback or 402. Let's return 402 so they contact support.
       return NextResponse.json({
         error: "NO_ACTIVE_CYCLE",
         reason: "missing_billing_cycle",
         creditsRemaining: 0
       }, { status: 402 });
    }

    return NextResponse.json({
      success: true,
      creditsCharged: data.creditsCharged,
      creditsRemaining: data.creditsRemaining,
      acceptedAdIds: data.acceptedAdIds,
      rejectedAdIds: data.rejectedAdIds,
      exhausted: data.exhausted
    });

  } catch (err) {
    console.error("[Credits API] Exception:", err);
    return NextResponse.json({ error: "Failed to report usage" }, { status: 500 });
  }
}
