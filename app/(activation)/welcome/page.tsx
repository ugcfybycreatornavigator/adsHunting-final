import { redirect } from "next/navigation";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WelcomeClient } from "./client";

export const metadata = { title: "Welcome to AdsHunting" };

export default async function WelcomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const entitlement = await getWorkspaceEntitlement(userId);
  if (!entitlement.hasAccess) {
    redirect("/billing");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_completed, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <WelcomeClient name={profile?.full_name || ""} />
    </div>
  );
}
