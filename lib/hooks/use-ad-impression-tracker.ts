import { useEffect, useRef } from "react";

export function useAdImpressionTracker(searchSessionId: string | null, isActive: boolean = true) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  useEffect(() => {
    if (!isActive || !searchSessionId) {
       observerRef.current?.disconnect();
       return;
    }

    // Impression tracking is now handled entirely on the server via delivery metering.
    // We maintain this hook to potentially trigger analytics events in the future
    // without tying it to the billing system.
    observerRef.current = new IntersectionObserver(() => {
      // Future client-side analytics implementation
    }, {
      threshold: 0.5
    });

    return () => {
       observerRef.current?.disconnect();
    };
  }, [searchSessionId, isActive]);

  return observerRef;
}
