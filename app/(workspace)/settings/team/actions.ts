"use server";

import { requireUser } from "@/lib/auth";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { getWorkspaceUsage } from "@/lib/billing/usage";
import { resolveWorkspaceAccess } from "@/lib/billing/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePlanKey } from "@/lib/billing/billing-config";

export async function inviteTeamMember(email: string): Promise<{ success?: boolean; message?: string; error?: string }> {
  const { userId } = await requireUser();
  if (!userId) {
    return { error: "Authentication required" };
  }

  // 1. Get entitlement and subscription
  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("plan_key")
    .eq("workspace_id", userId)
    .maybeSingle();

  const planKey = resolvePlanKey(sub?.plan_key as string);
  
  // 2. Resolve access limits
  const planLimits = resolveWorkspaceAccess(entitlement, planKey || "scout");
  
  // 3. Enforce Invite Capability
  if (!planLimits.canInviteMembers) {
    return { error: "Your current plan does not support team invitations. Please upgrade to Hunter or Agency." };
  }

  // 4. Enforce Seat Limit
  if (planLimits.teamMembers !== "unlimited") {
    const usage = await getWorkspaceUsage(userId);
    if (usage.teamMembers >= planLimits.teamMembers) {
      return { error: `Seat limit reached (${usage.teamMembers}/${planLimits.teamMembers}). Please upgrade your plan for more seats.` };
    }
  }

  // Team invitations require multi-seat workspace provisioning which is in private beta for Early Access.
  return {
    error: `Team invitations for ${email} are currently in private beta for Early Access workspaces. Contact support@adshunting.com to provision team member seats.`
  };
}
