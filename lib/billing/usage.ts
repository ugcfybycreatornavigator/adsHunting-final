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

export interface WorkspaceCreditBalance {
  creditsAllocated: number;
  creditsUsed: number;
  creditsRemaining: number;
  cycleStart: string | null;
  cycleEnd: string | null;
}

import { isPlatformOwner } from "@/lib/platform-owner";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";

export async function getWorkspaceCreditBalance(workspaceId: string): Promise<WorkspaceCreditBalance | null> {
  const isOwner = await isPlatformOwner(workspaceId);
  if (isOwner) {
    return {
      creditsAllocated: 999999999,
      creditsUsed: 0,
      creditsRemaining: 999999999,
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
    .order("cycle_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Attempt lazy reconciliation if they have an active entitlement but no balance row.
    const entitlement = await getWorkspaceEntitlement(workspaceId);
    if (entitlement.hasAccess) {
      const cycleStart = now;
      const cycleEnd = entitlement.currentPeriodEnd 
        ? entitlement.currentPeriodEnd 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
      const { data: newRow, error: insertError } = await admin
        .from("workspace_credit_balances")
        .insert({
          workspace_id: workspaceId,
          cycle_start: cycleStart,
          cycle_end: cycleEnd,
          credits_allocated: 10000,
          credits_used: 0,
        })
        .select("*")
        .single();
        
      if (!insertError && newRow) {
        return {
          creditsAllocated: Number(newRow.credits_allocated),
          creditsUsed: Number(newRow.credits_used),
          creditsRemaining: Math.max(0, Number(newRow.credits_allocated) - Number(newRow.credits_used)),
          cycleStart: newRow.cycle_start,
          cycleEnd: newRow.cycle_end,
        };
      }
    }
    return null;
  }

  const creditsRemaining = Math.max(0, Number(data.credits_allocated) - Number(data.credits_used));

  return {
    creditsAllocated: Number(data.credits_allocated),
    creditsUsed: Number(data.credits_used),
    creditsRemaining,
    cycleStart: data.cycle_start,
    cycleEnd: data.cycle_end,
  };
}

