"use client";

import { Card, Button } from "@/components/ui";
import { type WorkspaceEntitlement } from "@/lib/billing/subscription-state";
import { type PlanConfig } from "@/lib/billing/billing-config";
import { type WorkspaceCreditBalance } from "@/lib/billing/usage";
import { useState } from "react";
import { cancelSubscription } from "@/app/(workspace)/settings/billing/actions";
import { AppDialog } from "@/components/app-dialog";
import { Rocket, AlertTriangle } from "lucide-react";
import { EARLY_ACCESS, formatPaise } from "@/supabase/functions/_shared/early-access";

interface SettingsBillingProps {
  entitlement: WorkspaceEntitlement;
  planConfig: PlanConfig | null;
  creditBalance: WorkspaceCreditBalance | null;
}

export function SettingsBilling({ entitlement, planConfig, creditBalance }: SettingsBillingProps) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const displayPlanName = planConfig?.name || "No active plan";
  const isTrial = entitlement.accessSource === "trial";
  const isEarlyAccess = entitlement.accessSource === "early_access";
  
  const renewsDate = entitlement.currentPeriodEnd 
    ? new Date(entitlement.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) 
    : null;

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    const res = await cancelSubscription();
    if (res.error) {
      setError(res.error);
      setCancelling(false);
    } else {
      window.location.reload();
    }
  };

  const pct = creditBalance 
    ? creditBalance.unlimited ? 0 : Math.max(0, Math.min(100, ((creditBalance.creditsUsed || 0) / (creditBalance.creditsAllocated || 1)) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-[760px]">

      {/* Coming Soon Dialog */}
      <AppDialog
        open={showComingSoon}
        onClose={() => setShowComingSoon(false)}
        title="More Plans Coming Soon"
        icon={<Rocket size={22} />}
        dismissLabel="Got it"
      >
        <p>
          We are working on additional membership plans — Hunter and Agency — designed for growing teams and agencies.
          They will be available soon. Stay tuned!
        </p>
        <p className="mt-2 text-[13px] text-zinc-400">
          Your current <strong className="text-zinc-600">{displayPlanName}</strong> plan is active and fully functional.
        </p>
      </AppDialog>

      {/* Cancel Confirm Dialog */}
      <AppDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel Membership?"
        icon={<AlertTriangle size={22} className="text-red-500" />}
        confirmLabel={cancelling ? "Cancelling..." : "Yes, Cancel"}
        confirmVariant="signal"
        onConfirm={handleCancel}
        dismissLabel="Keep Membership"
      >
        <p>
          Are you sure you want to cancel your membership? You will retain access until the end of your current billing period.
        </p>
        {error && (
          <p className="mt-3 text-[13px] text-red-600 font-medium">{error}</p>
        )}
      </AppDialog>

      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-[#18181B]">Billing</h2>
        <p className="mt-1 text-[14px] text-[#71717A]">Manage your membership and account usage.</p>
      </div>

      <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B]">Current plan</h3>
        
        <div className="mt-4 border border-[#E1E1E1] rounded-[10px] p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
             <div className="flex-1">
               <h4 className="text-[18px] font-semibold text-[#18181B]">{displayPlanName}</h4>
               <p className="text-[13px] text-[#71717A] mt-1">Status: <span className="font-medium text-[#18181B]">{isEarlyAccess || (entitlement.billingStatus === "active" && !isTrial) ? "Active" : isTrial ? "Trial" : entitlement.billingStatus === "cancelled" ? "Cancelled" : "Inactive"}</span></p>
               <p className="text-[13px] text-[#71717A] mt-1">Price: {isEarlyAccess ? `${formatPaise(EARLY_ACCESS.totalPaise)} one-time (including GST)` : planConfig ? (planConfig.currentPrice ? `₹${planConfig.currentPrice} / month` : planConfig.priceLabel || "Free") : "-"}</p>
               
               {renewsDate && entitlement.billingStatus === "active" && (
                 <p className="text-[13px] text-[#71717A] mt-1">Next billing date: {renewsDate}</p>
               )}
               {renewsDate && entitlement.billingStatus === "cancelled" && (
                 <p className="text-[13px] text-[#71717A] mt-1">Access valid until: {renewsDate}</p>
               )}

               {planConfig?.features && planConfig.features.length > 0 && (
                 <div className="mt-4 pt-3 border-t border-[#F0F0F1]">
                   <p className="text-[12px] font-semibold uppercase tracking-wider text-[#71717A] mb-2">Included Features</p>
                   <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                     {planConfig.features.map((feat) => (
                       <li key={feat} className="text-[13px] text-[#3F3F46] flex items-center gap-2">
                         <span className="size-1.5 rounded-full bg-[#68B32F] shrink-0" />
                         {feat}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </div>
          </div>
          
          <div className="mt-6 pt-5 border-t border-[#E1E1E1]">
            <Button variant="secondary" className="h-[36px] text-[13px] font-medium" onClick={() => setShowComingSoon(true)}>
               {planConfig && planConfig.id === "scout" ? "Upgrade membership" : "Change plan"}
            </Button>
          </div>
        </div>
      </Card>

      {creditBalance && (
        <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
          <h3 className="text-[15px] font-semibold text-[#18181B]">Usage</h3>
          
          <div className="mt-4 border border-[#E1E1E1] rounded-[10px] p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#18181B]">Credits Used</p>
                <p className="text-[13px] text-[#71717A] mt-1">
                  {creditBalance.unlimited ? "Unlimited platform access" : isEarlyAccess ? "Included with your one-time purchase" : <>Resets on {creditBalance.cycleEnd ? new Date(creditBalance.cycleEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "next cycle"}</>}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[15px] font-semibold text-[#18181B]">
                  {creditBalance.unlimited ? (
                    <span className="text-[#68B32F] font-semibold">Unlimited</span>
                  ) : (
                    <>
                      {(creditBalance.creditsUsed || 0).toLocaleString()}{" "}
                      <span className="text-[#71717A] font-medium">/ {(creditBalance.creditsAllocated || 0).toLocaleString()}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {!creditBalance.unlimited && (
              <>
                <div className="h-2.5 w-full bg-[#ECEDEF] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${pct > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-[#68B32F] to-[#569b24]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {(creditBalance.creditsRemaining !== null && creditBalance.creditsRemaining <= 0) && (
                  <p className="text-[13px] text-red-600 font-medium mt-3">
                    {isEarlyAccess ? "You have used all included Early Access credits." : "You have run out of credits for this billing cycle. Wait until it resets to continue searching."}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      )}



      {!isEarlyAccess && <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B]">Subscription</h3>
        <div className="mt-4 flex flex-col gap-3">
          <Button variant="secondary" className="justify-center h-[36px] w-full sm:w-auto text-[13px] font-medium bg-white" onClick={() => setShowComingSoon(true)}>
            Manage membership
          </Button>
          {entitlement.billingStatus === "active" && !isTrial && (
            <Button variant="secondary" className="justify-center h-[36px] w-full sm:w-auto text-[13px] font-medium text-red-600 hover:text-red-700 bg-white" onClick={() => setShowCancelConfirm(true)} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel membership"}
            </Button>
          )}
        </div>
      </Card>}
    </div>
  );
}
