"use client";

import { Card } from "@/components/ui";
import { WorkspaceEntitlement } from "@/lib/billing/subscription-state";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase/clerk-client";
import { formatBillingDate } from "@/lib/format/date";
import { PlanConfig } from "@/lib/billing/billing-config";

type BillingStep =
  | "idle"
  | "preparing"
  | "creating_subscription"
  | "opening_checkout"
  | "authorizing"
  | "confirming"
  | "success"
  | "error";

type BillingError = {
  code?: string;
  message: string;
  requestId?: string;
};

// Cached promise for checkout script
let checkoutScriptPromise: Promise<boolean> | null = null;

const loadCheckoutScript = (): Promise<boolean> => {
  if (checkoutScriptPromise) return checkoutScriptPromise;

  if (typeof window !== "undefined" && (window as unknown as { Razorpay: unknown }).Razorpay) {
    checkoutScriptPromise = Promise.resolve(true);
    return checkoutScriptPromise;
  }

  checkoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      checkoutScriptPromise = null;
      reject(new Error("CHECKOUT_LOAD_FAILED"));
    };
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
};

export function PlanCard({
  entitlement,
  config,
}: {
  entitlement: WorkspaceEntitlement;
  config: PlanConfig;
}) {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const [step, setStep] = useState<BillingStep>("idle");
  const [error, setError] = useState<BillingError | null>(null);

  const hasAccess = entitlement.hasAccess === true && (entitlement.accessSource === "trial" || entitlement.accessSource === "subscription");
  const isTrial = entitlement.reason === "trial" || entitlement.accessSource === "trial";
  const isNotStarted = !hasAccess && entitlement.accessSource !== "legacy_grace";
  const isLegacyGrace = entitlement.accessSource === "legacy_grace";

  // Prevent multiple reconciliation polling
  const isPolling = useRef(false);

  const pollReconciliation = async () => {
    if (isPolling.current) return;
    isPolling.current = true;

    const delays = [1000, 2000, 3000, 5000, 8000];
    let success = false;

    for (const delay of delays) {
      await new Promise(r => setTimeout(r, delay));

      const { data: verifyRes, error: verifyError } = await supabase.functions.invoke('billing-reconcile-subscription', {
        method: 'POST',
      });

      if (!verifyError && verifyRes?.status && (verifyRes.status === "trialing" || verifyRes.status === "active")) {
        success = true;
        break;
      }
    }

    isPolling.current = false;

    if (success) {
      setStep("success");
      router.refresh();
    } else {
      setStep("error");
      setError({ message: "Your authorization was received, but we're still confirming it. Please check back in a few minutes." });
    }
  };

  const handleStartTrial = async () => {
    if (step !== "idle" && step !== "error") return;

    setStep("preparing");
    setError(null);
    try {
      try {
        await loadCheckoutScript();
      } catch {
        throw new Error("Secure checkout could not be loaded. Please check your connection and try again.");
      }

      if (!(window as unknown as { Razorpay: unknown }).Razorpay) {
        throw new Error("Secure checkout could not be loaded. Please check your connection and try again.");
      }

      setStep("creating_subscription");
      const { data, error: invokeError } = await supabase.functions.invoke('billing-create-subscription', {
        method: 'POST',
      });

      if (invokeError || !data?.ok) {
        throw new Error(data?.message || "We couldn't start your trial. Please try again.");
      }

      setStep("opening_checkout");

      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "AdsHunting",
        description: "AdsHunting Subscription",
        prefill: {
          name: user?.fullName || undefined,
          email: user?.primaryEmailAddress?.emailAddress || undefined,
        },
        handler: function () {
          setStep("confirming");
          pollReconciliation();
        },
        modal: {
          ondismiss: function () {
            setStep("idle");
          }
        },
        theme: {
          color: "#68B32F",
        },
      };

      const rzp = new (window as unknown as { Razorpay: new (options: unknown) => { on: (event: string, handler: () => void) => void; open: () => void; } }).Razorpay(options);
      rzp.on('payment.failed', function () {
        setStep("error");
        setError({ message: "We couldn't complete the authorization. Please try another payment method or retry." });
      });

      setStep("authorizing");
      rzp.open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStep("error");
      setError({ message });
    }
  };

  const getButtonText = () => {
    switch (step) {
      case "preparing": return "Preparing secure checkout…";
      case "creating_subscription": return "Setting up your trial…";
      case "opening_checkout": return "Opening secure checkout…";
      case "authorizing": return "Opening secure checkout…";
      case "confirming": return "Confirming your trial…";
      case "success": return "Trial activated!";
      default: return "Start 7-Day Free Trial";
    }
  };

  const isButtonDisabled = step !== "idle" && step !== "error";

  // Semantic Status Resolution
  const statusLabels: Record<string, string> = {
    not_started: "Not Started",
    authorization_required: "Authorization Required",
    trialing: "7-Day Free Trial",
    active: "Active",
    payment_processing: "Processing",
    past_due: "Past Due",
    halted: "Payment Issue",
    cancelled: "Cancelled",
    expired: "Expired",
    completed: "Completed"
  };

  const displayStatus = isLegacyGrace
    ? "Complimentary Access"
    : statusLabels[entitlement.billingStatus] || entitlement.billingStatus;

  const getBadgeColor = () => {
    if (isLegacyGrace) return "bg-brand-soft text-brand border border-brand/20";
    if (entitlement.billingStatus === "active") return "bg-brand-soft text-brand border border-brand/20";
    if (entitlement.billingStatus === "trialing") return "bg-zinc-100 text-zinc-600 border border-line/50";
    if (entitlement.billingStatus === "cancelled") return "bg-amber-50 text-amber-600 border border-amber-200/50";
    if (entitlement.billingStatus === "past_due" || entitlement.billingStatus === "halted") return "bg-red-50 text-red-600 border border-red-200/50";
    return "bg-zinc-100 text-zinc-600 border border-line/50";
  };

  // Not started state (Trial onboarding)
  if (isNotStarted) {
    if (step === "confirming") {
      return (
        <Card className="p-5 md:p-6 shadow-sm border border-line bg-white w-full">
          <div className="max-w-xl">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-ink break-words">
              Confirming your trial
            </h3>
            <p className="mt-4 text-sm md:text-base text-muted leading-relaxed">
              Your AutoPay authorization was successful.
              <br />
              We&apos;re waiting for confirmation from Razorpay. This usually takes a few seconds.
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm text-muted">
              <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
              Confirming subscription...
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-5 md:p-6 shadow-sm border border-line bg-white w-full">
        <div className="max-w-xl">
          <h3 className="text-[10px] font-bold tracking-wider text-muted uppercase mb-4">Current Subscription</h3>
          <h4 className="text-xl md:text-2xl font-bold tracking-tight text-ink break-words">
            {isLegacyGrace ? "Complimentary access" : "Activate your AdsHunting trial"}
          </h4>
          <p className="mt-4 text-sm md:text-base text-muted leading-relaxed">
            {isLegacyGrace ? (
              <>
                You have full AdsHunting access through 31 August 2026.<br />
                AdsHunting will require billing setup from 1 September.
              </>
            ) : (
              <>
                Set up AutoPay to unlock your 7-day free trial.<br />
                ₹{config.currentPrice?.toLocaleString('en-IN')}/month launch price after the trial.
              </>
            )}
          </p>

          <ul className="mt-6 space-y-3 text-sm text-muted break-words">
            {config.features.slice(0, 5).map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-brand flex-shrink-0">✓</span> {feature}
              </li>
            ))}
          </ul>

          {step === "error" && error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-sm font-semibold text-red-900">We couldn&apos;t activate your trial</h4>
              <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap break-words">{error.message}</p>
            </div>
          )}

          <button
            onClick={handleStartTrial}
            disabled={isButtonDisabled}
            className="mt-8 w-full md:w-auto bg-brand hover:bg-brand-hover text-white px-6 min-h-[44px] py-2.5 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>{getButtonText()}</span>
          </button>

          <p className="mt-4 text-xs text-muted max-w-sm">
            Secure payments powered by Razorpay. A small refundable authorization transaction may be required to activate AutoPay.
          </p>
        </div>
      </Card>
    );
  }

  // Active or Trialing State
  return (
    <Card className="p-5 md:p-6 shadow-sm border border-line bg-white w-full">
      <h3 className="text-[10px] font-bold tracking-wider text-muted uppercase mb-4">Current Subscription</h3>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-2xl font-bold tracking-tight text-ink break-words">{config.name}</h4>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getBadgeColor()}`}>
              {displayStatus}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-ink">₹{config.currentPrice?.toLocaleString('en-IN')}<span className="text-sm font-medium text-muted">/month</span></span>
            </div>

            {config.currentPrice !== config.regularPrice && (
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                  Launch Price
                </span>
                <span className="text-[13px] text-muted line-through">Regular price ₹{config.regularPrice?.toLocaleString('en-IN')}/month</span>
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-muted max-w-md break-words">
            Your current AdsHunting research plan.
          </p>

          <div className="mt-6 pt-6 border-t border-line/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isTrial && entitlement.trialEndsAt ? (
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Trial ends</p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {formatBillingDate(entitlement.trialEndsAt)}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  ₹{config.currentPrice?.toLocaleString('en-IN')}/month launch price after trial
                </p>
              </div>
            ) : entitlement.currentPeriodEnd ? (
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {entitlement.billingStatus === "cancelled" ? "Access valid until" : "Next billing"}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {formatBillingDate(entitlement.currentPeriodEnd)}
                </p>
              </div>
            ) : null}

            {entitlement.billingStatus === "active" && (
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Billing cycle</p>
                <p className="mt-1 text-sm font-medium text-ink">Monthly</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
