import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingStatus, EntitlementReason, WorkspaceEntitlement, AccessSource } from "./subscription-state";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isPreviewMode } from "@/lib/preview";
import { isPaymentReviewer } from "./reviewer";
import { isPlatformOwner } from "@/lib/platform-owner";

export async function getWorkspaceEntitlement(workspaceId: string): Promise<WorkspaceEntitlement> {
  const ownerAccess = await isPlatformOwner(workspaceId);
  if (ownerAccess) {
    return {
      hasAccess: true,
      accessSource: "subscription",
      billingStatus: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      nextChargeAt: null,
      legacyGraceEndsAt: null,
      reason: "active_subscription",
    };
  }

  const reviewerAccess = await isPaymentReviewer(workspaceId);
  if (reviewerAccess) {
    return {
        hasAccess: true,
        accessSource: "subscription",
        billingStatus: "active",
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextChargeAt: null,
        legacyGraceEndsAt: null,
        reason: "active_subscription",
    };
  }

  if (isPreviewMode || process.env.NODE_ENV === "development") {
     return {
        hasAccess: true,
        accessSource: "subscription",
        billingStatus: "active",
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextChargeAt: null,
        legacyGraceEndsAt: null,
        reason: "active_subscription",
     };
  }

  if (process.env.EARLY_ACCESS_BYPASS === "true") {
    return {
      hasAccess: true,
      accessSource: "legacy_grace",
      billingStatus: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      nextChargeAt: null,
      legacyGraceEndsAt: null,
      reason: "legacy_grace",
    };
  }
  
  const admin = createAdminClient();
  const [subResponse, grantResponse] = await Promise.all([
    admin.from("billing_subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("billing_access_grants").select("*").eq("workspace_id", workspaceId).eq("grant_type", "legacy_grace").maybeSingle()
  ]);

  const sub = subResponse.data;
  const legacyGrant = grantResponse.data;

  const now = new Date();
  let hasAccess = false;
  let accessSource: AccessSource = null;
  let reason: EntitlementReason = null;
  
  const localStatus: BillingStatus = sub ? (sub.status as BillingStatus) : "not_started";
  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  
  const legacyGraceEndsAt = legacyGrant?.ends_at ? new Date(legacyGrant.ends_at) : null;
  const isLegacyGraceActive = legacyGraceEndsAt && now < legacyGraceEndsAt;

  if (localStatus === "active") {
    hasAccess = true;
    accessSource = "subscription";
    reason = "active_subscription";
  } else if (localStatus === "trialing" && trialEndsAt && now < trialEndsAt) {
    hasAccess = true;
    accessSource = "trial";
    reason = "trial";
  } else if (localStatus === "cancelled" && currentPeriodEnd && now < currentPeriodEnd) {
    hasAccess = true;
    accessSource = "subscription";
    reason = "active_subscription";
  } else if (isLegacyGraceActive) {
    hasAccess = true;
    accessSource = "legacy_grace";
    reason = "legacy_grace";
  } else if (localStatus === "past_due" || localStatus === "halted") {
    hasAccess = false;
    reason = "payment_failed";
  } else if (localStatus === "cancelled" && (!currentPeriodEnd || now >= currentPeriodEnd)) {
    hasAccess = false;
    reason = "cancelled";
  } else {
    hasAccess = false;
    reason = "payment_required";
  }

  return {
    hasAccess,
    accessSource,
    billingStatus: localStatus,
    trialEndsAt: sub?.trial_ends_at || null,
    currentPeriodEnd: sub?.current_period_end || null,
    nextChargeAt: sub?.next_charge_at || null,
    legacyGraceEndsAt: legacyGrant?.ends_at || null,
    reason,
  };
}

export async function requirePaidWorkspaceAccess() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const entitlement = await getWorkspaceEntitlement(userId);
  if (!entitlement.hasAccess) {
    return NextResponse.json(
      { error: "Payment required.", reason: entitlement.reason },
      { status: 402 }
    );
  }
  return null; // indicates success, no error response
}
