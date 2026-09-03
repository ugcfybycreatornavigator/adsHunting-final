"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { Button } from "@/components/ui";
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
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand mb-6">
        <Mail size={32} strokeWidth={1.5} />
      </div>
      
      <h3 className="text-lg font-semibold text-ink">Get in touch via email</h3>
      <p className="mt-2 text-sm text-muted max-w-[280px] sm:max-w-sm">
        Questions about your account, billing, data, or AdsHunting? Send us a message and our team will help.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface/50 pl-4 pr-1.5 py-1.5">
          <span className="truncate text-sm font-medium text-ink select-all">{email}</span>
          <Button
            variant="ghost"
            className="h-8 px-3 text-xs bg-white border border-line shadow-sm hover:bg-surface hover:text-ink"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check size={14} className="text-brand" />
                <span className="text-brand">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy
              </>
            )}
          </Button>
        </div>

        <a
          href={`mailto:${email}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
        >
          Open mail client
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}
