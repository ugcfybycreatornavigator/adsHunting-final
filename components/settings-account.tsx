"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { Button, Card } from "@/components/ui";
import { LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { WorkspaceEntitlement } from "@/lib/billing/subscription-state";
import { BILLING_CONFIG, resolvePlanKey } from "@/lib/billing/billing-config";

export function SettingsAccount({ 
  entitlement, 
  subscription 
}: { 
  entitlement?: WorkspaceEntitlement | null, 
  subscription?: Record<string, unknown> | null 
}) {
  const { isLoaded, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (!isLoaded || !user) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ redirectUrl: "/sign-in" });
  };

  // Determine Plan Details
  const planKey = resolvePlanKey(subscription?.plan_key as string);
  const planInfo = planKey ? BILLING_CONFIG[planKey] : null;
  
  const displayPlanName = planInfo?.name || "No active plan";
  const displayInitial = displayPlanName[0]?.toUpperCase() || "S";
  
  // Status Resolution
  const status = entitlement?.billingStatus;
  const isTrial = entitlement?.accessSource === "trial";
  const isActive = entitlement?.hasAccess && !isTrial && entitlement?.accessSource !== "legacy_grace";
  const isLegacy = entitlement?.accessSource === "legacy_grace";
  
  // Dates
  const renewsDate = entitlement?.currentPeriodEnd ? new Date(entitlement.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const trialEndsDate = entitlement?.trialEndsAt ? new Date(entitlement.trialEndsAt) : null;
  const trialDaysRemaining = trialEndsDate && now ? Math.max(0, Math.ceil((trialEndsDate.getTime() - now) / (1000 * 60 * 60 * 24))) : 0;
  const formattedTrialEnds = trialEndsDate ? trialEndsDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

  // Price
  const price = subscription?.amount_paise ? `₹${(subscription.amount_paise as number) / 100} / month` : null;

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-sm">
        <h3 className="text-base font-semibold">Profile</h3>
        <p className="mt-1 text-sm text-muted">Your personal account information.</p>
        
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <img src={user.imageUrl} alt="Avatar" className="size-16 rounded-full border border-line object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.fullName || "User"}</p>
            <p className="text-sm text-muted truncate">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <Button variant="secondary" className="sm:w-auto w-full" onClick={() => openUserProfile()}>
            Edit Profile
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-6 shadow-sm bg-white border border-line rounded-[16px]">
        <h3 className="text-base font-semibold text-ink">Account & Plan</h3>
        <p className="mt-1 text-sm text-muted">Manage your current AdsHunting subscription.</p>
        
        <div className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex gap-3">
              {entitlement?.hasAccess ? (
                <div className="size-10 rounded-lg flex items-center justify-center bg-brand-soft border border-brand/20 text-brand font-bold shrink-0">
                  {displayInitial}
                </div>
              ) : (
                <div className="size-10 rounded-lg flex items-center justify-center bg-zinc-100 border border-line text-zinc-500 font-bold shrink-0">
                  {displayInitial}
                </div>
              )}
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-ink">{isLegacy ? "Complimentary Access" : displayPlanName}</h4>
                  
                  {isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                      <span className="size-1.5 rounded-full bg-brand"></span>
                      ACTIVE
                    </span>
                  )}
                  {isTrial && (
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-line/50">
                      <span className="size-1.5 rounded-full bg-zinc-400"></span>
                      7-DAY TRIAL
                    </span>
                  )}
                  {status === "cancelled" && entitlement?.hasAccess && (
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                      CANCELLED
                    </span>
                  )}
                  {(status === "past_due" || status === "halted") && (
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/50">
                      PAST DUE
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-muted mt-0.5">Personal Account</p>
                
                {entitlement?.hasAccess && price && !isLegacy && (
                  <div className="mt-4 space-y-1">
                    <p className="text-[14px] font-medium text-ink">{price}</p>
                    
                    {isTrial ? (
                      <p className="text-[13px] text-muted">
                        {trialDaysRemaining} days remaining. Paid subscription begins {formattedTrialEnds}.
                      </p>
                    ) : status === "cancelled" ? (
                      <p className="text-[13px] text-muted">
                        Access valid until {renewsDate}.
                      </p>
                    ) : renewsDate ? (
                      <p className="text-[13px] text-muted">
                        {status === "active" ? "Renews" : "Next billing"}: {renewsDate}
                      </p>
                    ) : null}
                  </div>
                )}
                
                {isLegacy && entitlement?.legacyGraceEndsAt && (
                   <div className="mt-4">
                     <p className="text-[13px] text-muted">
                        Valid until {new Date(entitlement.legacyGraceEndsAt).toLocaleDateString()}.
                     </p>
                   </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
              {entitlement?.hasAccess ? (
                 <>
                   <Link href="/settings/billing" className="w-full sm:w-auto">
                     <Button variant="secondary" className="w-full justify-center">Manage subscription</Button>
                   </Link>
                   <Link href="/settings/billing" className="w-full sm:w-auto">
                     <Button variant="secondary" className="w-full justify-center">View plans</Button>
                   </Link>
                 </>
              ) : (
                 <Link href="/settings/billing" className="w-full sm:w-auto">
                   <Button variant="primary" className="w-full justify-center bg-brand hover:bg-brand-hover text-white">Choose a plan</Button>
                 </Link>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-sm">
        <h3 className="text-base font-semibold">Session</h3>
        <p className="mt-1 text-sm text-muted">Manage your active authentication session.</p>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Signed in as</p>
            <p className="text-sm text-muted truncate">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto justify-center" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={16} className="mr-2" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
