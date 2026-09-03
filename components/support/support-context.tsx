"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type SupportTab = "email" | "booking" | "feedback";
export type FeedbackType = "Bug" | "Feature request" | "Data issue" | "Billing" | "Account" | "General feedback" | "Other";

export interface SupportContextData {
  page?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface OpenSupportOptions {
  tab?: SupportTab;
  feedbackType?: FeedbackType;
  context?: SupportContextData;
}

interface SupportContextValue {
  isOpen: boolean;
  activeTab: SupportTab;
  feedbackType: FeedbackType | undefined;
  supportContext: SupportContextData | undefined;
  openSupport: (options?: OpenSupportOptions) => void;
  closeSupport: () => void;
  setActiveTab: (tab: SupportTab) => void;
  setFeedbackType: (type: FeedbackType | undefined) => void;
}

const SupportContext = createContext<SupportContextValue | undefined>(undefined);

export function SupportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SupportTab>("email");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | undefined>(undefined);
  const [supportContext, setSupportContext] = useState<SupportContextData | undefined>(undefined);

  const openSupport = (options?: OpenSupportOptions) => {
    if (options?.tab) setActiveTab(options.tab);
    if (options?.feedbackType) setFeedbackType(options.feedbackType);
    if (options?.context) setSupportContext(options.context);
    setIsOpen(true);
  };

  const closeSupport = () => {
    setIsOpen(false);
    // Optional: Keep the state around for a bit while animating out, or reset immediately.
    // We'll let the modal handle animation and reset if needed.
  };

  return (
    <SupportContext.Provider
      value={{
        isOpen,
        activeTab,
        feedbackType,
        supportContext,
        openSupport,
        closeSupport,
        setActiveTab,
        setFeedbackType,
      }}
    >
      {children}
    </SupportContext.Provider>
  );
}

export function useSupport() {
  const context = useContext(SupportContext);
  if (context === undefined) {
    throw new Error("useSupport must be used within a SupportProvider");
  }
  return context;
}
