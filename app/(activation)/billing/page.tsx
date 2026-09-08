import { redirect } from "next/navigation";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EarlyAccessCheckout } from "@/components/billing/EarlyAccessCheckout";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";

export const metadata = { title: "Early Access · AdsHunting" };

export default async function BillingGatePage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const rawOrderId = Array.isArray(params.order_id) ? params.order_id[0] : params.order_id;
  const returnOrderId = rawOrderId && /^ea_[a-f0-9]{32}$/.test(rawOrderId) ? rawOrderId : null;

  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (entitlement.hasAccess && entitlement.accessSource !== "early_access") {
    if (profile && !profile.onboarding_completed) {
      redirect("/welcome");
    } else {
      redirect("/dashboard");
    }
  }

  const creditBalance = entitlement.accessSource === "early_access"
    ? await getWorkspaceCreditBalance(userId)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <EarlyAccessCheckout
        isActive={entitlement.accessSource === "early_access"}
        creditsRemaining={creditBalance?.creditsRemaining ?? null}
        returnOrderId={returnOrderId}
      />
    </div>
  );
}
