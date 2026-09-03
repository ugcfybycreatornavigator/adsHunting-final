import { getPlanEntitlements, resolveWorkspaceAccess } from "../limits";
import { type WorkspaceEntitlement } from "../subscription-state";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("Running entitlement tests...");

  // Test Scout
  const scout = getPlanEntitlements("scout");
  assert(scout.canInviteMembers === false, "Scout cannot invite members");
  assert(scout.teamMembers === 1, "Scout has 1 team member limit");
  assert(scout.swipeFiles === 5, "Scout has Swipe Files limit");
  assert(scout.sharedAds === 10, "Scout has 10 shared ads limit");

  // Test Hunter
  const hunter = getPlanEntitlements("hunter");
  assert(hunter.canInviteMembers === true, "Hunter can invite members");
  assert(hunter.teamMembers === 5, "Hunter has 5 team member limit");
  assert(hunter.swipeFiles === "unlimited", "Hunter has unlimited swipe files");

  // Test Agency
  const agency = getPlanEntitlements("agency");
  assert(agency.canInviteMembers === true, "Agency can invite members");
  assert(agency.teamMembers === 20, "Agency has 20 team member limit");

  // Test Subscription Access Denied (fallback to Scout limits)
  const deniedEntitlement: WorkspaceEntitlement = {
    hasAccess: false,
    accessSource: null,
    billingStatus: "past_due",
    trialEndsAt: null,
    currentPeriodEnd: null,
    nextChargeAt: null,
    legacyGraceEndsAt: null,
    reason: "payment_failed",
  };
  const deniedAccess = resolveWorkspaceAccess(deniedEntitlement, "hunter");
  assert(deniedAccess.canInviteMembers === false, "Denied hunter access cannot invite members");
  assert(deniedAccess.teamMembers === 1, "Denied hunter access defaults to 1 member limit");

  // Test Subscription Access Allowed
  const allowedEntitlement: WorkspaceEntitlement = {
    hasAccess: true,
    accessSource: "subscription",
    billingStatus: "active",
    trialEndsAt: null,
    currentPeriodEnd: null,
    nextChargeAt: null,
    legacyGraceEndsAt: null,
    reason: "active_subscription",
  };
  const allowedAccess = resolveWorkspaceAccess(allowedEntitlement, "hunter");
  assert(allowedAccess.canInviteMembers === true, "Allowed hunter access can invite members");
  assert(allowedAccess.teamMembers === 5, "Allowed hunter access gets 5 members");

  console.log("All entitlement tests passed!");
}

runTests().catch(console.error);
