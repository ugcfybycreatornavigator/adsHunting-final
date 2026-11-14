"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface CreditsState {
  unlimited: boolean;
  creditsRemaining: number | null;
  creditsAllocated: number | null;
  creditsUsed: number | null;
  isExhausted: boolean;
  cycleStart: string | null;
  cycleEnd: string | null;
}
interface CreditsContextValue {
  state: CreditsState | null;
  syncState: (newState: Partial<CreditsState>) => void;
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

  const syncState = useCallback((newState: Partial<CreditsState>) => {
    setState(prev => {
      if (!prev) {
        return {
          unlimited: newState.unlimited || false,
          creditsRemaining: newState.creditsRemaining ?? null,
          creditsAllocated: newState.creditsAllocated ?? null,
          creditsUsed: newState.creditsUsed ?? null,
          isExhausted: newState.isExhausted || false,
          cycleStart: newState.cycleStart || null,
          cycleEnd: newState.cycleEnd || null,
        };
      }
      return { ...prev, ...newState };
    });
  }, []);

  return (
    <CreditsContext.Provider value={{ state, syncState }}>
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
    };
  }
  return ctx;
}
