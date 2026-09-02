import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { auth } from "@clerk/nextjs/server";
import { PlanCard } from "./PlanCard";
import { BillingStatusCard } from "./BillingStatusCard";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { BillingHistory } from "./BillingHistory";
import { BILLING_CONFIG, resolvePlanKey } from "@/lib/billing/billing-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExplorePlans } from "./ExplorePlans";

export async function BillingOverview() {
  const { userId } = await auth();
  if (!userId) return null;

  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("billing_payments")
    .select("*")
    .eq("workspace_id", userId)
    .order("created_at", { ascending: false });

  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("workspace_id", userId)
    .maybeSingle();

  // Resolve the actual plan key (defaults to scout, maps legacy "pro" to "scout", etc.)
  const currentPlanKey = resolvePlanKey(sub?.plan_key);
  const currentPlanConfig = currentPlanKey ? BILLING_CONFIG[currentPlanKey] : BILLING_CONFIG["scout"];

  return (
    <div className="space-y-12 max-w-4xl">
      <section>
        <PlanCard entitlement={entitlement} config={currentPlanConfig} />
      </section>

      {entitlement.billingStatus !== "not_started" && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BillingStatusCard entitlement={entitlement} />
          <PaymentMethodCard subscription={sub} />
        </section>
      )}

      <section>
        <ExplorePlans currentPlanKey={currentPlanKey} />
      </section>

      {entitlement.billingStatus !== "not_started" && (
        <section className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Billing history</h3>
          <BillingHistory payments={payments || []} />
        </section>
      )}
    </div>
  );
}
