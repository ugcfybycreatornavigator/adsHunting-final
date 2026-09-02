import { SettingsBilling } from "@/components/settings-billing";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { BILLING_CONFIG, resolvePlanKey } from "@/lib/billing/billing-config";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth } from "@clerk/nextjs/server";

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

  const planKey = resolvePlanKey(sub?.plan_key as string);
  const planConfig = planKey ? BILLING_CONFIG[planKey] : null;

  let creditBalance = await getWorkspaceCreditBalance(userId);

  if (!creditBalance && entitlement.hasAccess) {
    const nowStr = new Date().toISOString();
    const futureStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    creditBalance = {
      creditsAllocated: 10000,
      creditsUsed: 0,
      creditsRemaining: 10000,
      cycleStart: nowStr,
      cycleEnd: entitlement.currentPeriodEnd || futureStr,
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
