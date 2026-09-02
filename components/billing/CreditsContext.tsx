"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export interface CreditsState {
  creditsRemaining: number;
  creditsAllocated: number;
  creditsUsed: number;
  isExhausted: boolean;
  cycleStart: string | null;
  cycleEnd: string | null;
}

interface CreditsContextValue {
  state: CreditsState | null;
  syncState: (newState: Partial<CreditsState>) => void;
  reportUsage: (session: string, event: "ad_impression" | "ad_open", adIds: string[]) => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ 
  children, 
  initialState 
}: { 
  children: React.ReactNode, 
  initialState: CreditsState | null 
}) {
  const [state, setState] = useState<CreditsState | null>(initialState);
  const pendingRequests = useRef(new Set<string>());

  const syncState = useCallback((newState: Partial<CreditsState>) => {
    setState(prev => {
      if (!prev) {
        // Fallback for edge cases where initial was null
        return {
          creditsRemaining: newState.creditsRemaining || 0,
          creditsAllocated: newState.creditsAllocated || 10000,
          creditsUsed: newState.creditsUsed || 0,
          isExhausted: newState.isExhausted || false,
          cycleStart: newState.cycleStart || null,
          cycleEnd: newState.cycleEnd || null,
        };
      }
      return { ...prev, ...newState };
    });
  }, []);

  const reportUsage = useCallback(async (session: string, event: "ad_impression" | "ad_open", adIds: string[]) => {
    if (adIds.length === 0) return;
    
    const key = `${session}_${event}_${adIds.join(',')}`;
    if (pendingRequests.current.has(key)) return;
    pendingRequests.current.add(key);

    try {
      const res = await fetch("/api/credits/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchSessionId: session, event, adIds })
      });
      
      const data = await res.json();
      
      if (res.ok || res.status === 402) {
        if (data.creditsRemaining !== undefined) {
           syncState({
             creditsRemaining: data.creditsRemaining,
             isExhausted: data.exhausted || data.creditsRemaining <= 0,
             // Calculate used by subtracting from allocated since the API might just return remaining
             creditsUsed: state ? state.creditsAllocated - data.creditsRemaining : undefined
           });
        }
      }
    } catch (e) {
      console.error("[Credits] Failed to report usage", e);
    } finally {
      // We purposefully don't delete from pendingRequests to debounce identical requests aggressively
      // However, if we need to track same ad multiple times (not possible per idempotency anyway)
      setTimeout(() => pendingRequests.current.delete(key), 5000);
    }
  }, [state, syncState]);

  return (
    <CreditsContext.Provider value={{ state, syncState, reportUsage }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    return {
      state: null,
      syncState: () => {},
      reportUsage: async () => {}
    };
  }
  return ctx;
}
