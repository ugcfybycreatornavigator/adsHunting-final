"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { Check, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AdsHuntingLogo } from "@/components/brand/AdsHuntingLogo";
import { Card } from "@/components/ui";
import { useSupabaseClient } from "@/lib/supabase/clerk-client";
import { EARLY_ACCESS, formatPaise } from "@/supabase/functions/_shared/early-access";

type CheckoutState =
  | "idle"
  | "creating_order"
  | "checkout_opening"
  | "checkout_open"
  | "payment_processing"
  | "verifying"
  | "success"
  | "failed"
  | "cancelled"
  | "pending"
  | "already_active"
  | "network_error";

type CashfreeCheckoutResult = {
  error?: { message?: string };
  paymentDetails?: { paymentMessage?: string };
};

type CashfreeSdk = {
  checkout(options: { paymentSessionId: string; redirectTarget: "_modal" }): Promise<CashfreeCheckoutResult>;
};

interface CashfreeWindow extends Window {
  Cashfree: (options: { mode: "sandbox" | "production" }) => CashfreeSdk;
}

let checkoutScriptPromise: Promise<void> | null = null;

function loadCashfreeCheckout() {
  if (typeof window !== "undefined" && (window as unknown as CashfreeWindow).Cashfree) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;
  checkoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScriptPromise = null;
      reject(new Error("Secure Cashfree checkout could not be loaded."));
    };
    document.body.appendChild(script);
  });
  return checkoutScriptPromise;
}

async function getFunctionError(error: unknown, fallback: string) {
  if (error instanceof Error && "context" in error) {
    const response = (error as Error & { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const body = await response.clone().json().catch(() => null) as { message?: string; code?: string } | null;
        if (body?.message) return { message: body.message, code: body.code };
      } catch {
        // safe fallback if response.clone() throws
      }
    }
  }
  return { message: error instanceof Error ? error.message : fallback, code: undefined };
}

const benefits = [
  "Search & Discover Ads",
  "Ad Intelligence",
  "Winner Score",
  "Swipe Files",
  "Brand Research",
  "3,000 Early Access Credits",
];

export function EarlyAccessCheckout({
  isActive,
  creditsRemaining,
  returnOrderId,
}: {
  isActive: boolean;
  creditsRemaining: number | null;
  returnOrderId: string | null;
}) {
  const router = useRouter();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const supabase = useSupabaseClient();
  const [state, setState] = useState<CheckoutState>(isActive ? "already_active" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(returnOrderId);
  const [phone, setPhone] = useState("");
  const returnVerificationStarted = useRef(false);

  useEffect(() => {
    const clerkPhone = user?.primaryPhoneNumber?.phoneNumber;
    if (clerkPhone) setPhone((current) => current || clerkPhone);
  }, [user]);

  const verifyPayment = useCallback(async (orderId: string, token: string) => {
    const delays = [0, 1200, 2500, 4000, 6500];
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      setState(delay ? "payment_processing" : "verifying");
      const { data, error } = await supabase.functions.invoke("billing-verify-early-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { orderId },
      });
      if (!error && data?.active) {
        setPendingOrderId(null);
        setState(data.alreadyProcessed ? "already_active" : "success");
        router.push("/discover");
        router.refresh();
        return;
      }
      if (!error && data?.processing) continue;
      const parsed = await getFunctionError(error, data?.message || "Payment verification failed.");
      if (parsed.code === "PAYMENT_CANCELLED") {
        setPendingOrderId(null);
        setState("cancelled");
      } else if (parsed.code === "PAYMENT_FAILED") {
        setPendingOrderId(null);
        setState("failed");
      } else if (parsed.code === "PAYMENT_EVIDENCE_MISMATCH") setState("failed");
      else setState("network_error");
      setMessage(parsed.message);
      return;
    }
    setState("pending");
    setMessage("Your payment is still being confirmed. Do not pay again; retry verification shortly.");
  }, [router, supabase.functions]);

  useEffect(() => {
    if (!returnOrderId || !isLoaded || returnVerificationStarted.current) return;
    returnVerificationStarted.current = true;
    void getToken().then((token) => {
      if (!token) {
        setState("network_error");
        setMessage("Please sign in to verify your payment.");
        return;
      }
      void verifyPayment(returnOrderId, token);
    });
  }, [getToken, isLoaded, returnOrderId, verifyPayment]);

  const startCheckout = async () => {
    const retryable = ["idle", "failed", "cancelled", "pending", "network_error"].includes(state);
    if (!isLoaded || !retryable) return;
    setMessage(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in to continue.");
      if (pendingOrderId) {
        await verifyPayment(pendingOrderId, token);
        return;
      }
      if (!phone.trim()) {
        setState("failed");
        setMessage("Enter your phone number to continue with Cashfree checkout.");
        return;
      }

      setState("creating_order");
      const { data, error } = await supabase.functions.invoke("billing-create-early-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { customerPhone: phone },
      });
      console.log("Cashfree checkout diagnostics:", {
        hasError: !!error,
        dataOk: data?.ok,
        orderIdType: typeof data?.orderId,
        paymentSessionIdType: typeof data?.paymentSessionId,
        hasSession: !!data?.paymentSessionId,
        mode: data?.mode,
      });

      if (error || !data?.ok) {
        const parsed = await getFunctionError(error, data?.message || "Checkout could not be created.");
        if (parsed.code === "EARLY_ACCESS_ALREADY_ACTIVE") {
          setState("already_active");
          router.refresh();
          return;
        }
        setState("network_error");
        setMessage(parsed.message);
        return;
      }

      const orderId = typeof data?.orderId === "string" && data.orderId.trim() ? data.orderId.trim() : null;
      if (!orderId) throw new Error("Cashfree returned an invalid order.");
      
      setPendingOrderId(orderId);
      
      if (data.paymentPendingVerification) {
        await verifyPayment(orderId, token);
        return;
      }

      const paymentSessionId = typeof data?.paymentSessionId === "string" && data.paymentSessionId.trim() ? data.paymentSessionId.trim() : null;
      if (!paymentSessionId) {
        throw new Error("Cashfree order was created but no valid payment session was returned.");
      }

      if (data.mode !== "sandbox" && data.mode !== "production") throw new Error("Cashfree returned an invalid environment.");

      setState("checkout_opening");
      await loadCashfreeCheckout();
      
      if (typeof (window as unknown as CashfreeWindow).Cashfree !== "function") {
        throw new Error("Cashfree checkout could not be initialized.");
      }
      
      const cashfree = (window as unknown as CashfreeWindow).Cashfree({ mode: data.mode });
      setState("checkout_open");
      const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });

      // The browser result is only a prompt to reconcile. Access is granted only
      // after the server fetches Cashfree's order and payment resources.
      setState("payment_processing");
      await verifyPayment(orderId, token);
      if (result.error?.message) setMessage((current) => current || result.error?.message || null);
    } catch (error: unknown) {
      setState("network_error");
      setMessage(error instanceof Error ? error.message : "Checkout could not be started. Please try again.");
    }
  };

  if (isActive || state === "success" || state === "already_active") {
    return (
      <Card className="w-full max-w-xl border-brand/20 bg-white p-8 text-center shadow-sm md:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Check size={25} /></div>
        <h1 className="mt-5 text-2xl font-bold text-ink">Early Access Active</h1>
        <p className="mt-2 text-sm text-muted">
          {creditsRemaining === null ? "Your AdsHunting access is ready." : `${creditsRemaining.toLocaleString("en-IN")} credits remaining.`}
        </p>
        <button onClick={() => router.push("/discover")} className="mt-7 w-full rounded-md bg-brand px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-hover">
          Continue to AdsHunting
        </button>
      </Card>
    );
  }

  const busy = ["creating_order", "checkout_opening", "checkout_open", "payment_processing", "verifying"].includes(state);
  const label = state === "creating_order" ? "Preparing secure checkout…"
    : state === "checkout_opening" ? "Opening Cashfree checkout…"
      : state === "checkout_open" ? "Checkout open…"
        : state === "verifying" ? "Verifying payment…"
          : state === "payment_processing" ? "Confirming payment…"
            : pendingOrderId ? "Retry payment verification"
              : `Get Early Access — ${formatPaise(EARLY_ACCESS.totalPaise)}`;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-7 flex justify-center"><AdsHuntingLogo /></div>
      <Card className="overflow-hidden border border-line bg-white shadow-sm">
        <div className="p-6 md:p-9">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">One-time payment</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">Get Early Access</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">Start using AdsHunting today with Early Access.</p>
            <div className="mt-6 text-4xl font-bold text-ink">₹499.00 <span className="text-base font-medium text-muted">+ 18% GST</span></div>
            <p className="mt-2 text-sm font-semibold text-brand">Early Access — ₹499.00 + 18% GST</p>
          </div>

          <div className="mt-8 grid gap-7 md:grid-cols-2">
            <ul className="space-y-3">
              {benefits.map((benefit) => <li key={benefit} className="flex gap-2.5 text-sm text-ink"><Check className="mt-0.5 shrink-0 text-brand" size={16} /><span>{benefit}</span></li>)}
            </ul>
            <div className="rounded-lg border border-line bg-[#FAFAFA] p-5 text-sm">
              <div className="flex justify-between py-2 text-muted"><span>Early Access</span><span>{formatPaise(EARLY_ACCESS.basePricePaise)}</span></div>
              <div className="flex justify-between py-2 text-muted"><span>GST (18%)</span><span>{formatPaise(EARLY_ACCESS.gstPaise)}</span></div>
              <div className="mt-2 flex justify-between border-t border-line pt-4 text-base font-bold text-ink"><span>Total</span><span>{formatPaise(EARLY_ACCESS.totalPaise)}</span></div>
            </div>
          </div>

          <label className="mt-7 block text-sm font-semibold text-ink" htmlFor="cashfree-phone">Phone number</label>
          <input
            id="cashfree-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91 98765 43210"
            disabled={busy || Boolean(pendingOrderId)}
            className="mt-2 w-full rounded-md border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-gray-50"
          />
          <p className="mt-1.5 text-xs text-muted">Cashfree uses this number to authenticate checkout and send payment updates.</p>

          <button onClick={startCheckout} disabled={busy || !isLoaded} className="mt-6 w-full rounded-md bg-brand px-5 py-3.5 font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-65">
            {label}
          </button>
          {message && <div role="alert" className={`mt-4 rounded-md border p-3 text-sm ${state === "cancelled" || state === "pending" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>{message}</div>}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted"><LockKeyhole size={13} /> Secure checkout powered by Cashfree</p>
        </div>
      </Card>
    </div>
  );
}
