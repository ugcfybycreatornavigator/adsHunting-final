import { BILLING_CONFIG, type PlanKey } from "./billing-config";
import { type WorkspaceEntitlement } from "./subscription-state";

export type PlanEntitlements = {
  teamMembers: number | "unlimited";
  canInviteMembers: boolean;
  swipeFiles: number | "unlimited";
  sharedAds: number | "unlimited";
};

export function getPlanEntitlements(plan: PlanKey): PlanEntitlements {
  const config = BILLING_CONFIG[plan];
  const limits = config?.limits;

  if (!limits) {
    // Ultimate fallback if something is missing
    return {
      teamMembers: 1,
      canInviteMembers: false,
      swipeFiles: 5,
      sharedAds: 10,
    };
  }

  return {
    teamMembers: limits.teamMembers,
    canInviteMembers: plan === "hunter" || plan === "agency",
    swipeFiles: limits.swipeFiles,
    sharedAds: limits.sharedAds,
  };
}

export function resolveWorkspaceAccess(entitlement: WorkspaceEntitlement | null, plan: PlanKey): PlanEntitlements {
  // If no entitlement or access is denied, they are restricted
  // We can return a heavily restricted set of entitlements or the base scout limits depending on the business rule.
  // We'll return Scout limits as the baseline since free/restricted accounts often fall back to basic limits.
  // Actually, if !entitlement.hasAccess, maybe they shouldn't be able to do premium actions at all.
  
  if (!entitlement?.hasAccess) {
    return getPlanEntitlements("scout");
  }

  return getPlanEntitlements(plan);
}
