"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ShieldCheck, Sparkles, CheckCircle2, ArrowRight, X } from "lucide-react";
import Link from "next/link";

const OWNER_EMAIL = "creatornavigator@gmail.com";
const STORAGE_KEY = "adshunting_owner_welcomed_v1";

export function OwnerWelcomeModal() {
  const { isLoaded, user } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (email === OWNER_EMAIL) {
      const welcomed = localStorage.getItem(STORAGE_KEY);
      if (!welcomed) {
        setOpen(true);
      }
    }
  }, [isLoaded, user]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-8">
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Badge & Header */}
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-[#68B32F]/10 text-[#68B32F]">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#68B32F]/15 px-2 py-0.5 text-[11px] font-semibold text-[#529322]">
              <Sparkles size={11} /> Platform Owner
            </span>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 mt-0.5">
              Welcome back, Admin!
            </h2>
          </div>
        </div>

        {/* Message */}
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          You are authenticated as the <strong>Platform Owner</strong> (
          <code className="text-[12px] bg-zinc-100 px-1.5 py-0.5 rounded font-mono text-zinc-800">
            {OWNER_EMAIL}
          </code>
          ). Your account has unrestricted lifetime access across all systems.
        </p>

        {/* Privileges List */}
        <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
            Active Super Admin Privileges
          </p>
          <ul className="space-y-2 text-xs text-zinc-700 font-medium">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#68B32F] shrink-0" />
              <span><strong>Unlimited Credits:</strong> Permanent zero-balance blocking bypass</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#68B32F] shrink-0" />
              <span><strong>Lifetime Access:</strong> Exempt from all subscription gates and trials</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#68B32F] shrink-0" />
              <span><strong>Full Platform Scope:</strong> Unlimited swipe files, brands, and intelligence</span>
            </li>
          </ul>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Link
            href="/settings/billing"
            onClick={handleDismiss}
            className="w-full sm:w-auto text-center px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition"
          >
            View Billing & Usage
          </Link>
          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#68B32F] to-[#569b24] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition"
          >
            Get Started
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
