"use client";

import { Card } from "@/components/ui";
import { type PlanConfig } from "@/lib/billing/billing-config";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useSupabaseClient } from "@/lib/supabase/clerk-client";

type BillingStep =
  | "idle"
  | "preparing"
  | "creating_subscription"
  | "opening_checkout"
  | "authorizing"
  | "confirming"
  | "success"
  | "error";

interface WindowWithRazorpay extends Window {
  Razorpay: new (options: Record<string, unknown>) => {
    on: (event: string, handler: () => void) => void;
    open: () => void;
  };
}

let checkoutScriptPromise: Promise<boolean> | null = null;
const loadCheckoutScript = (): Promise<boolean> => {
  if (checkoutScriptPromise) return checkoutScriptPromise;
  if (typeof window !== "undefined" && (window as unknown as WindowWithRazorpay).Razorpay) return Promise.resolve(true);

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

export function BillingGateClient({ config }: { config: PlanConfig }) {
  const router = useRouter();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const supabase = useSupabaseClient();
  const [step, setStep] = useState<BillingStep>("idle");
  const [activeCheckoutType, setActiveCheckoutType] = useState<"trial" | "subscription" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPolling = useRef(false);

  const pollReconciliation = async () => {
    if (isPolling.current) return;
    isPolling.current = true;

    const delays = [1000, 2000, 3000, 5000, 8000];
    let success = false;

    for (const delay of delays) {
      await new Promise(r => setTimeout(r, delay));
      const { data: verifyRes, error: verifyError } = await supabase.functions.invoke('billing-reconcile-subscription', { method: 'POST' });
      if (!verifyError && verifyRes?.status && (verifyRes.status === "trialing" || verifyRes.status === "active")) {
        success = true;
        break;
      }
    }

    isPolling.current = false;

    if (success) {
      setStep("success");
      router.push("/welcome");
    } else {
      setStep("error");
      setError("Your authorization was received, but we're still confirming it. Please check back in a few minutes.");
    }
  };

  const handleCheckout = async (checkoutType: "trial" | "subscription") => {
    if (!isLoaded) return;
    if (step !== "idle" && step !== "error") return;
    setActiveCheckoutType(checkoutType);
    setStep("preparing");
    setError(null);
    try {
      await loadCheckoutScript();
      if (!(window as unknown as WindowWithRazorpay).Razorpay) throw new Error("Secure checkout could not be loaded.");

      const token = await getToken();
      if (!token) {
        throw new Error("AUTH_REQUIRED");
      }

      setStep("creating_subscription");
      const { data, error: invokeError } = await supabase.functions.invoke('billing-create-subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { checkoutType, planKey: config.id }
      });

      if (invokeError) {
        // FunctionsHttpError contains the raw Response in the context property
        if (invokeError instanceof Error && 'context' in invokeError) {
          const context = (invokeError as Error & { context?: Response }).context;
          if (context && typeof context.json === 'function') {
            try {
              // Clone the response because it might have been read already
              const errorBody = await context.clone().json();
              if (errorBody && errorBody.message) {
                // Attach the error code to the error object so we can use it in catch block
                const err = new Error(errorBody.message);
                Object.assign(err, { code: errorBody.code });
                throw err;
              }
            } catch (e: unknown) {
              // If it failed to parse as JSON or threw inside try
              if (e instanceof Error && (e as Error & { code?: string }).code) throw e;

              const errorText = await context.clone().text();
              console.error(`Edge Function error (${context.status}):`, errorText.substring(0, 500));
            }
          }
        }
        throw new Error(invokeError.message || "We couldn't start checkout. Please try again.");
      }

      if (!data?.ok) throw new Error(data?.message || "We couldn't start checkout. Please try again.");

      setStep("opening_checkout");
      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "AdsHunting",
        description: checkoutType === "trial" ? "AdsHunting 7-Day Trial" : "AdsHunting Subscription",
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
            setActiveCheckoutType(null);
          }
        },
        theme: { color: "#68B32F" },
      };

      const rzp = new (window as unknown as WindowWithRazorpay).Razorpay(options);
      rzp.on('payment.failed', function () {
        setStep("error");
        setActiveCheckoutType(null);
        setError("We couldn't complete the authorization. Please try another payment method or retry.");
      });

      setStep("authorizing");
      rzp.open();
    } catch (err: unknown) {
      setStep("error");
      setActiveCheckoutType(null);
      // Map known internal error codes to user-friendly messages securely
      const code = typeof err === 'object' && err !== null ? (err as Record<string, unknown>).code : "";
      const errMsg = err instanceof Error ? err.message : String(err);

      if (code === "SUBSCRIPTION_CREATE_FAILED") {
        setError("Checkout configuration is invalid. Please contact support or try again shortly.");
      } else if (code === "BILLING_CONFIG_MISSING") {
        setError("Checkout is temporarily unavailable. Please try again shortly.");
      } else if (code === "TRIAL_ALREADY_USED" || errMsg.includes("introductory trial has already been used")) {
        setError("Your introductory trial has already been used. Subscribe to Scout to continue.");
      } else if (code === "SUBSCRIPTION_ALREADY_EXISTS") {
        setError("You already have an active subscription.");
      } else if (code === "AUTH_REQUIRED" || errMsg === "AUTH_REQUIRED") {
        setError("Please sign in to continue with checkout.");
      } else {
        // Fallback for general errors
        setError("We couldn't start checkout. Please try again.");
        console.error("Checkout failed:", err);
      }
    }
  };

  const isButtonDisabled = step !== "idle" && step !== "error" || !isLoaded;

  if (step === "confirming") {
    return (
      <Card className="p-8 max-w-xl w-full text-center">
        <h3 className="text-2xl font-bold text-ink">Confirming your payment...</h3>
        <p className="mt-4 text-muted">Please wait while we verify your access. This usually takes a few seconds.</p>
        <div className="mt-8 flex justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl w-full space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">AdsHunting</h1>
        <h2 className="text-xl text-muted font-medium">Start finding winning ads</h2>
        <p className="text-muted text-sm">Choose how you&apos;d like to get started.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <Card className="p-6 md:p-8 flex flex-col h-full bg-white shadow-sm hover:shadow-md transition-shadow border-line">
          <div>
            <h3 className="text-xl font-bold">7-Day Trial</h3>
            <p className="mt-2 text-sm text-muted">Explore AdsHunting before committing.</p>
          </div>
          <div className="mt-6 flex-grow">
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-center gap-2"><span className="text-brand">✓</span> Access AdsHunting for 7 days</li>
              <li className="flex items-center gap-2"><span className="text-brand">✓</span> Discover ads & search</li>
              <li className="flex items-center gap-2"><span className="text-brand">✓</span> Competitor research</li>
              <li className="flex items-center gap-2"><span className="text-brand">✓</span> Cancel anytime</li>
            </ul>
          </div>
          <button
            onClick={() => handleCheckout("trial")}
            disabled={isButtonDisabled}
            className="mt-8 w-full bg-brand hover:bg-brand-hover text-white py-3 rounded-md font-medium transition-colors disabled:opacity-70"
          >
            {activeCheckoutType === "trial" && step !== "idle" && step !== "error" ? "Starting trial..." : "Start 7-Day Trial"}
          </button>
        </Card>

        <Card className="p-6 md:p-8 flex flex-col h-full bg-white shadow-sm hover:shadow-md transition-shadow border-brand/30 ring-1 ring-brand/10">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{config.name}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-soft text-brand px-2 py-0.5 rounded-full">Monthly</span>
            </div>
            <p className="mt-2 text-2xl font-bold">₹{config.currentPrice?.toLocaleString('en-IN')} <span className="text-sm font-normal text-muted">/ month</span></p>
            <p className="text-sm text-muted mt-2">{config.audience}</p>
          </div>
          <div className="mt-6 flex-grow">
            <ul className="space-y-3 text-sm text-muted">
              {config.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><span className="text-brand">✓</span> {f}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => handleCheckout("subscription")}
            disabled={isButtonDisabled}
            className="mt-8 w-full bg-brand hover:bg-brand-hover text-white py-3 rounded-md font-medium transition-colors disabled:opacity-70"
          >
            {activeCheckoutType === "subscription" && step !== "idle" && step !== "error" ? "Preparing checkout..." : `Subscribe to ${config.name}`}
          </button>
        </Card>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-center max-w-xl mx-auto">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <p className="text-center text-xs text-muted mt-8">Secure payments powered by Razorpay.</p>
    </div>
  );
}
