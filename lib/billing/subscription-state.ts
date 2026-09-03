export const BILLING_ENFORCEMENT_CUTOFF_AT = "2026-08-19T11:08:00Z";
export const LEGACY_GRACE_ENDS_AT = "2026-08-31T18:30:00Z";

export type BillingStatus =
  | "not_started"
  | "authorization_required"
  | "trialing"
  | "active"
  | "payment_processing"
  | "past_due"
  | "halted"
  | "cancelled"
  | "expired"
  | "completed";

export type EntitlementReason =
  | "trial"
  | "active_subscription"
  | "legacy_grace"
  | "payment_required"
  | "payment_failed"
  | "cancelled"
  | null;

export type AccessSource = "subscription" | "trial" | "legacy_grace" | null;

export interface WorkspaceEntitlement {
  hasAccess: boolean;
  accessSource: AccessSource;
  billingStatus: BillingStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  legacyGraceEndsAt: string | null;
  reason: EntitlementReason;
}
