import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WorkspaceUsage {
  swipeFiles: number;
  sharedAds: number;
  teamMembers: number;
}

export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // For this application architecture, workspaceId acts as the owner_user_id/user_id in these tables
  // Swipe files are grouped by swipe_files table, we want the number of distinct swipe files
  // shared ads are tracked by shared_ad_links where owner_user_id = workspaceId
  
  const [swipeFilesRes, sharedAdsRes] = await Promise.all([
    admin
      .from("swipe_files")
      .select("*", { count: "exact", head: true })
      .eq("user_id", workspaceId)
      // exclude default swipe file which might be system generated
      .neq("is_default", true),
    admin
      .from("shared_ad_links")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", workspaceId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
  ]);

  // For team members, in the current simple Clerk implementation for Scout, it's 1. 
  // If Clerk Organizations are used, we'd query Clerk. For now, since team invites are not fully active for Scout,
  // we default to 1 for the owner, unless we fetch from Clerk orgs.
  // We'll hardcode 1 for now and rely on Clerk if organizations exist.
  // To avoid adding clerk-sdk calls unnecessarily if not in org context, we just return 1.
  const teamMembers = 1;
  // if (workspaceId.startsWith('org_')) {
  //    teamMembers = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: workspaceId }).then(res => res.totalCount);
  // }

  return {
    swipeFiles: swipeFilesRes.count ?? 0,
    sharedAds: sharedAdsRes.count ?? 0,
    teamMembers,
  };
}

export const CREDIT_COSTS = {
  AD_SEARCH: 15,
  BRAND_SEARCH: 15,
  AD_DELIVERED: 10,
};

export interface WorkspaceCreditBalance {
  unlimited: boolean;
  creditsAllocated: number | null;
  creditsUsed: number | null;
  creditsRemaining: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
}

import { isPlatformOwner } from "@/lib/platform-owner";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";

export async function getWorkspaceCreditBalance(workspaceId: string): Promise<WorkspaceCreditBalance | null> {
  const isOwner = await isPlatformOwner(workspaceId);
  if (isOwner) {
    return {
      unlimited: true,
      creditsAllocated: null,
      creditsUsed: null,
      creditsRemaining: null,
      cycleStart: null,
      cycleEnd: null,
    };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("workspace_credit_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gt("cycle_end", now)
    .order("cycle_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const entitlement = await getWorkspaceEntitlement(workspaceId);
    if (!entitlement.hasAccess) return null;

    if (entitlement.accessSource === "early_access") {
      // Reconcile missing early access balance row using original successful payment
      const { data: payment } = await admin
        .from("billing_payments")
        .select("id, provider, provider_order_id, provider_payment_id, paid_at")
        .eq("workspace_id", workspaceId)
        .eq("payment_type", "early_access")
        .eq("status", "paid")
        .maybeSingle();

      if (payment && payment.provider_order_id && payment.provider_payment_id) {
        const { data: reconciled, error: reconError } = await admin.rpc("finalize_early_access_purchase", {
          p_workspace_id: workspaceId,
          p_provider: payment.provider,
          p_order_id: payment.provider_order_id,
          p_payment_id: payment.provider_payment_id,
          p_paid_at: payment.paid_at || now,
        });

        if (!reconError && reconciled) {
          // Fetch the newly reconciled balance
          const { data: newBalance } = await admin
            .from("workspace_credit_balances")
            .select("*")
            .eq("workspace_id", workspaceId)
            .gt("cycle_end", now)
            .order("cycle_start", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (newBalance) {
             return {
              unlimited: false,
              creditsAllocated: Number(newBalance.credits_allocated),
              creditsUsed: Number(newBalance.credits_used),
              creditsRemaining: Math.max(0, Number(newBalance.credits_allocated) - Number(newBalance.credits_used)),
              cycleStart: newBalance.cycle_start,
              cycleEnd: newBalance.cycle_end,
            };
          }
        }
      }

      // If we reach here, we know they have early_access entitlement but the ledger cannot prove it.
      // Do NOT silently return 0 used / 3000 allocated.
      console.error(`[Billing] Missing credit balance row for paid workspace ${workspaceId}. Reconciliation failed.`);
      return null;
    }

    // Non-early-access paid plans without a balance row.
    // In the future this handles subscriptions. For now we return null.
    return null;
  }

  const creditsRemaining = Math.max(0, Number(data.credits_allocated) - Number(data.credits_used));

  return {
    unlimited: false,
    creditsAllocated: Number(data.credits_allocated),
    creditsUsed: Number(data.credits_used),
    creditsRemaining,
    cycleStart: data.cycle_start,
    cycleEnd: data.cycle_end,
  };
}

export async function consumeUsage(
  workspaceId: string,
  userId: string,
  sessionId: string,
  baseEventType: "AD_SEARCH" | "BRAND_SEARCH" | null,
  baseFingerprint: string | null,
  baseCost: number,
  deliveryEventType: "AD_DELIVERED" | null,
  deliveryAdIds: string[],
  deliveryCostPerAd: number
) {
  const isOwner = await isPlatformOwner(workspaceId);
  if (isOwner) {
    return {
      success: true,
      unlimited: true,
      baseCharged: false,
      creditsChargedThisRequest: 0,
      acceptedAdIds: deliveryAdIds,
      creditsRemaining: null,
      creditsAllocated: null,
      creditsUsed: null,
      exhausted: false
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("report_search_and_delivery_usage", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_search_session_id: sessionId,
    p_base_event_type: baseEventType,
    p_base_fingerprint: baseFingerprint,
    p_base_cost: baseCost,
    p_delivery_event_type: deliveryEventType,
    p_delivery_ad_ids: deliveryAdIds,
    p_delivery_cost: deliveryCostPerAd,
    p_metadata: {}
  });

  if (error) {
    console.error("[Usage] RPC error consuming credits:", error);
    return { success: false, error: "RPC_ERROR" };
  }

  return { ...data, unlimited: false };
}
