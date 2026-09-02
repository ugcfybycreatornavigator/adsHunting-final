"use client";

import { useState, useEffect } from "react";
import { ExternalLink, CalendarX2 } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { supportConfig } from "@/lib/support/config";
import { useSupport } from "./support-context";

export function BookingSupport() {
  const { setActiveTab } = useSupport();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const bookingUrl = supportConfig.bookingUrl;

  useEffect(() => {
    // Only timeout to show error if we have a URL and it takes too long (e.g. 10s)
    if (!bookingUrl) return;
    const timer = setTimeout(() => {
      if (loading) setError(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading, bookingUrl]);

  if (!bookingUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface text-muted mb-6">
          <CalendarX2 size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-ink">Booking is currently unavailable</h3>
        <p className="mt-2 text-sm text-muted max-w-sm">
          We haven&apos;t set up a public calendar yet. Please reach out via email instead.
        </p>
        <Button 
          variant="secondary" 
          className="mt-6"
          onClick={() => setActiveTab("email")}
        >
          Email support
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-50 text-signal mb-6">
          <CalendarX2 size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-ink">We couldn&apos;t load the calendar</h3>
        <p className="mt-2 text-sm text-muted max-w-sm">
          There might be a connection issue with our scheduling provider.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="secondary" onClick={() => { setLoading(true); setError(false); }}>
            Try again
          </Button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Open booking page
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] sm:h-[600px] rounded-lg overflow-hidden bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col gap-4 p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="flex gap-4">
            <div className="w-1/3 flex flex-col gap-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
            </div>
            <div className="w-2/3 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      )}
      <iframe
        src={bookingUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
        className="absolute inset-0 z-0 bg-transparent"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        title="Book a call"
      />
    </div>
  );
}
