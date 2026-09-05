"use client";

import { useEffect, useRef } from "react";
import { X, Mail, CalendarDays, MessageSquare, Headphones } from "lucide-react";
import { useSupport } from "./support-context";
import { cn } from "@/lib/utils";
import { EmailSupport } from "./EmailSupport";
import { BookingSupport } from "./BookingSupport";
import { FeedbackSupport } from "./FeedbackSupport";

export function SupportModal() {
  const { isOpen, closeSupport, activeTab, setActiveTab } = useSupport();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      // Basic focus trap - focus the modal when it opens
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      } else {
        modalRef.current?.focus();
      }
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px] animate-in fade-in duration-150"
        onMouseDown={closeSupport}
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex flex-col w-full bg-white shadow-2xl outline-none overflow-hidden",
          "rounded-t-3xl sm:rounded-3xl",
          "h-[90vh] sm:h-auto sm:max-h-[90vh]",
          activeTab === "booking" ? "sm:max-w-[800px]" : "sm:max-w-[480px]",
          "animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 transition-all"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeSupport();
        }}
      >
        {/* Premium Header */}
        <div className="relative px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-5 shrink-0 bg-white">
          <button
            onClick={closeSupport}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Close support modal"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="grid size-14 place-items-center rounded-full bg-brand/10 text-brand ring-4 ring-brand/5">
                <Headphones size={24} strokeWidth={2} />
              </div>
              <div className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white bg-green-500" />
            </div>
            <div>
              <h2 id="support-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
                How can we help?
              </h2>
              <p className="mt-0.5 text-sm font-medium text-muted">
                Our team is here to assist you.
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-6 sm:px-8 pb-4 shrink-0 bg-white border-b border-line">
          <div className="flex rounded-lg bg-zinc-100/80 p-1">
            {[
              { id: "email", label: "Email", icon: Mail },
              { id: "booking", label: "Book a call", icon: CalendarDays },
              { id: "feedback", label: "Feedback", icon: MessageSquare },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "email" | "booking" | "feedback")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    isActive
                      ? "bg-white text-ink shadow-sm ring-1 ring-zinc-200/50"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <tab.icon size={15} className={isActive ? "text-brand" : "text-muted opacity-70"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area with Proper Padding */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-zinc-50/50 p-6 sm:p-8">
          <div className="animate-in fade-in duration-300 slide-in-from-bottom-2 h-full">
            {activeTab === "email" && <EmailSupport />}
            {activeTab === "booking" && <BookingSupport />}
            {activeTab === "feedback" && <FeedbackSupport />}
          </div>
        </div>
      </div>
    </div>
  );
}
