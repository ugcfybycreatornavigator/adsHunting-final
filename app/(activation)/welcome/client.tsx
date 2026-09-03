"use client";

import { Card } from "@/components/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";

export function WelcomeClient({ name }: { name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    const res = await completeOnboarding();
    if (res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const displayName = name ? name.split(" ")[0] : "there";

  return (
    <div className="max-w-2xl w-full">
      <Card className="p-8 md:p-12 text-center shadow-md bg-white border-line">
        <div className="mx-auto w-16 h-16 bg-brand-soft text-brand rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">Welcome to AdsHunting, {displayName}!</h1>
        <p className="text-lg text-muted mb-8">Your account is ready. Let&apos;s start finding winning ads.</p>

        <div className="text-left bg-zinc-50 p-6 rounded-lg border border-line mb-8 space-y-4">
          <h3 className="font-semibold text-ink">What&apos;s next?</h3>
          <ul className="space-y-3 text-sm text-muted">
             <li className="flex gap-3">
               <span className="text-brand shrink-0">1.</span>
               <span><strong>Discover Ads:</strong> Search our database of high-performing creatives.</span>
             </li>
             <li className="flex gap-3">
               <span className="text-brand shrink-0">2.</span>
               <span><strong>Competitors:</strong> Track other brands and analyze their strategies.</span>
             </li>
             <li className="flex gap-3">
               <span className="text-brand shrink-0">3.</span>
               <span><strong>Swipe Files:</strong> Save your favorite ads for inspiration.</span>
             </li>
          </ul>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-md text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-brand hover:bg-brand-hover text-white py-3 px-6 rounded-md font-medium text-lg transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {loading ? (
             <>
               <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
               Preparing your dashboard...
             </>
          ) : (
             "Go to Dashboard"
          )}
        </button>
      </Card>
    </div>
  );
}
