import { SettingsTeam } from "@/components/settings-team";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { getWorkspaceUsage } from "@/lib/billing/usage";
import { resolveWorkspaceAccess } from "@/lib/billing/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePlanKey } from "@/lib/billing/billing-config";
import { auth, currentUser } from "@clerk/nextjs/server";

export const metadata = { title: "Team Settings" };

export default async function TeamSettingsPage() {
  const { userId } = await auth();
  const clerkUser = await currentUser();
  
  if (!userId || !clerkUser) {
    return null;
  }

  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("plan_key")
    .eq("workspace_id", userId)
    .maybeSingle();
    
  const planKey = resolvePlanKey(sub?.plan_key as string);
  const limits = resolveWorkspaceAccess(entitlement, planKey || "scout");
  const usage = await getWorkspaceUsage(userId);
  
  const members = [
    {
      id: userId,
      name: clerkUser.fullName || "User",
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      imageUrl: clerkUser.imageUrl,
      role: "Owner",
    }
  ];

  return (
    <div className="max-w-[760px] space-y-6">
      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-[#18181B]">Team</h2>
        <p className="mt-1 text-[14px] text-[#71717A]">Manage people in your workspace.</p>
      </div>
      
      <SettingsTeam 
        limits={limits} 
        usage={usage} 
        members={members}
        planKey={planKey}
      />
    </div>
  );
}
