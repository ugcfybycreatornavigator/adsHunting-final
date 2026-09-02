import { redirect } from "next/navigation";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { auth } from "@clerk/nextjs/server";
import { isPreviewMode } from "@/lib/preview";

export default async function PaidRoutesLayout({ children }: { children: React.ReactNode }) {
  if (isPreviewMode) return <>{children}</>;
  
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const entitlement = await getWorkspaceEntitlement(userId);
  
  // Bypass billing redirect
  // if (!entitlement.hasAccess) {
  //   redirect(`/settings/billing?reason=subscription_required`);
  // }

  return <>{children}</>;
}
