"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { supportConfig } from "@/lib/support/config";

export function EmailSupport() {
  const [copied, setCopied] = useState(false);
  const email = supportConfig.email;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email", err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="grid size-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-line text-brand mb-5">
          <Mail size={24} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-ink">Send us a message</h3>
        <p className="mt-2 text-[14px] text-muted max-w-[300px] leading-relaxed">
          Questions about your account or features? Drop us a line and we&apos;ll reply within 24 hours.
        </p>
      </div>

      <div className="flex flex-col gap-3 max-w-[320px] mx-auto w-full">
        <div className="group flex items-center justify-between rounded-xl border border-line bg-zinc-50 pl-4 pr-1.5 py-1.5 transition-colors hover:bg-zinc-100 hover:border-zinc-300">
          <span className="truncate text-[14px] font-medium text-ink select-all">{email}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm ring-1 ring-inset ring-line hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {copied ? (
              <><Check size={14} className="text-brand" /> <span className="text-brand">Copied</span></>
            ) : (
              <><Copy size={14} className="text-muted" /> Copy</>
            )}
          </button>
        </div>

        <a
          href={`mailto:${email}`}
          className="group flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[14px] font-semibold text-white shadow-md transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Open Mail App
          <ExternalLink size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 text-white/70 group-hover:text-white" />
        </a>
      </div>
    </div>
  );
}
