import { redirect } from "next/navigation";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { auth } from "@clerk/nextjs/server";
import { isPreviewMode } from "@/lib/preview";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";
import { CreditsProvider, CreditsState } from "@/components/billing/CreditsContext";

export default async function PaidRoutesLayout({ children }: { children: React.ReactNode }) {
  if (isPreviewMode) return <>{children}</>;
  
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const entitlement = await getWorkspaceEntitlement(userId);
  
  // Bypass billing redirect
  // if (!entitlement.hasAccess) {
  //   redirect(`/settings/billing?reason=subscription_required`);
  // }

  const balance = await getWorkspaceCreditBalance(userId);
  const nowStr = new Date().toISOString();
  const futureStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const initialState: CreditsState | null = balance ? {
    creditsAllocated: balance.creditsAllocated,
    creditsUsed: balance.creditsUsed,
    creditsRemaining: balance.creditsRemaining,
    cycleStart: balance.cycleStart,
    cycleEnd: balance.cycleEnd,
    isExhausted: balance.creditsRemaining <= 0
  } : (entitlement.hasAccess ? {
    creditsAllocated: 10000,
    creditsUsed: 0,
    creditsRemaining: 10000,
    cycleStart: nowStr,
    cycleEnd: entitlement.currentPeriodEnd || futureStr,
    isExhausted: false
  } : null);

  return (
    <CreditsProvider initialState={initialState}>
      {children}
    </CreditsProvider>
  );
}
