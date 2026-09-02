import { useEffect, useRef } from "react";
import { useCredits } from "@/components/billing/CreditsContext";

export function useAdImpressionTracker(searchSessionId: string | null, isActive: boolean = true) {
  const { reportUsage } = useCredits();
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Track visibility duration
  const visibilityTimers = useRef<Map<string, number>>(new Map());
  const pendingImpressions = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!isActive || !searchSessionId) return;

    // Flush batch every 3 seconds
    const interval = setInterval(() => {
      if (pendingImpressions.current.size > 0) {
        const batch = Array.from(pendingImpressions.current);
        pendingImpressions.current.clear();
        reportUsage(searchSessionId, "ad_impression", batch);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      // Flush remaining on unmount/session change
      if (pendingImpressions.current.size > 0) {
        const batch = Array.from(pendingImpressions.current);
        pendingImpressions.current.clear();
        reportUsage(searchSessionId, "ad_impression", batch);
      }
    };
  }, [searchSessionId, isActive, reportUsage]);

  useEffect(() => {
    if (!isActive || !searchSessionId) {
       observerRef.current?.disconnect();
       return;
    }

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const adId = entry.target.getAttribute("data-ad-id");
        if (!adId) return;

        if (entry.isIntersecting) {
          // start timer
          if (!visibilityTimers.current.has(adId)) {
            const timer = window.setTimeout(() => {
              pendingImpressions.current.add(adId);
              visibilityTimers.current.delete(adId);
              // Stop observing once it qualifies as an impression for this session
              observerRef.current?.unobserve(entry.target);
            }, 400); // 400ms threshold
            visibilityTimers.current.set(adId, timer);
          }
        } else {
          // clear timer if they scrolled past too quickly
          if (visibilityTimers.current.has(adId)) {
            clearTimeout(visibilityTimers.current.get(adId));
            visibilityTimers.current.delete(adId);
          }
        }
      });
    }, {
      threshold: 0.5 // 50% visible
    });

    return () => {
       observerRef.current?.disconnect();
       visibilityTimers.current.forEach(timer => clearTimeout(timer));
       visibilityTimers.current.clear();
    };
  }, [searchSessionId, isActive]);

  return observerRef;
}
