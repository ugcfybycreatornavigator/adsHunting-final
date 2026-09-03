import { SettingsBilling } from "@/components/settings-billing";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { BILLING_CONFIG, resolvePlanKey, type PlanConfig } from "@/lib/billing/billing-config";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { isPlatformOwner } from "@/lib/platform-owner";

export const metadata = { title: "Payments & Billing" };

export default async function BillingSettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("workspace_id", userId)
    .maybeSingle();

  const isOwner = await isPlatformOwner(userId);
  const planKey = resolvePlanKey(sub?.plan_key as string);
  const planConfig: PlanConfig = isOwner
    ? {
        id: "agency",
        name: "Platform Owner",
        audience: "Super Administrator / Platform Owner",
        priceLabel: "Lifetime Access",
        status: "available",
        features: [
          "Unlimited Searches",
          "Unlimited Credits",
          "Unlimited Swipe Files",
          "Unlimited Shared Ads",
          "Super Admin Access",
        ],
        limits: {
          teamMembers: "unlimited",
          swipeFiles: "unlimited",
          sharedAds: "unlimited",
        },
      }
    : (planKey && BILLING_CONFIG[planKey])
    ? BILLING_CONFIG[planKey]
    : BILLING_CONFIG.scout;

  let creditBalance = await getWorkspaceCreditBalance(userId);

  if (!creditBalance && entitlement.hasAccess) {
    creditBalance = {
      creditsAllocated: 10000,
      creditsUsed: 0,
      creditsRemaining: 10000,
      cycleStart: null,
      cycleEnd: entitlement.currentPeriodEnd ?? null,
    };
  }

  return (
    <SettingsBilling 
       entitlement={entitlement}
       planConfig={planConfig}
       creditBalance={creditBalance}
    />
  );
}
