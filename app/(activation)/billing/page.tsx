import { redirect } from "next/navigation";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { BILLING_CONFIG } from "@/lib/billing/billing-config";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingGateClient } from "./client";

export const metadata = { title: "Choose a Plan · AdsHunting" };

export default async function BillingGatePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (entitlement.hasAccess) {
    if (profile && !profile.onboarding_completed) {
      redirect("/welcome");
    } else {
      redirect("/dashboard");
    }
  }

  const scoutConfig = BILLING_CONFIG["scout"];

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <BillingGateClient config={scoutConfig!} />
    </div>
  );
}
