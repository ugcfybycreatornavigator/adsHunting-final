"use client";

import { Card } from "@/components/ui";
import { BILLING_CONFIG, PlanKey } from "@/lib/billing/billing-config";

export function ExplorePlans({ currentPlanKey }: { currentPlanKey: PlanKey | null }) {
  const plans = Object.values(BILLING_CONFIG);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-foreground">Explore AdsHunting plans</h3>
      
      <div className="flex flex-col gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanKey;

          return (
            <Card key={plan.id} className="p-5 md:p-6 shadow-sm border-border/50 bg-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="text-lg font-bold text-ink">{plan.name}</h4>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand uppercase tracking-wider border border-brand/20">
                        CURRENT PLAN
                      </span>
                    )}
                    {plan.status === "coming_soon" && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 uppercase tracking-wider border border-line/50">
                        COMING SOON
                      </span>
                    )}
                  </div>
                  
                  <p className="mt-1 text-sm text-muted">
                    {plan.audience}
                  </p>

                  <div className="mt-4 flex flex-wrap items-baseline gap-2">
                    {plan.status === "available" && plan.regularPrice && plan.currentPrice ? (
                      <>
                        <span className="text-sm text-muted line-through font-medium">₹{plan.regularPrice.toLocaleString('en-IN')}</span>
                        <span className="text-xl font-bold text-ink">₹{plan.currentPrice.toLocaleString('en-IN')}<span className="text-sm font-medium text-muted">/month</span></span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-ink">{plan.priceLabel}</span>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-auto flex-shrink-0">
                  {plan.status === "available" ? (
                    <button 
                      disabled={true} 
                      className="w-full md:w-[160px] h-10 px-4 rounded-md border border-line bg-zinc-50 text-zinc-400 font-medium text-sm select-none"
                    >
                      {isCurrent ? "Current Plan" : "Available"}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                       <button 
                         disabled={true} 
                         className="w-full md:w-[160px] h-10 px-4 rounded-md border border-line bg-zinc-50 text-zinc-400 font-medium text-sm select-none"
                       >
                         Coming Soon
                       </button>
                       <span className="text-[11px] text-muted text-center hidden md:block">Future upgrade option</span>
                    </div>
                  )}
                </div>

              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
