import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";
import { isPreviewMode } from "@/lib/preview";
import { getWorkspaceCreditBalance } from "@/lib/billing/usage";
import { CreditsProvider, CreditsState } from "@/components/billing/CreditsContext";

export default async function PaidRoutesLayout({ children }: { children: React.ReactNode }) {
  if (isPreviewMode) return <>{children}</>;
  
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");


  
  // Bypass billing redirect
  // if (!entitlement.hasAccess) {
  //   redirect(`/settings/billing?reason=subscription_required`);
  // }

  const balance = await getWorkspaceCreditBalance(userId);
  
  const initialState: CreditsState | null = balance ? {
    creditsAllocated: balance.creditsAllocated,
    creditsUsed: balance.creditsUsed,
    creditsRemaining: balance.creditsRemaining,
    cycleStart: balance.cycleStart,
    cycleEnd: balance.cycleEnd,
    isExhausted: balance.creditsRemaining <= 0
  } : null;

  return (
    <CreditsProvider initialState={initialState}>
      {children}
    </CreditsProvider>
  );
}
