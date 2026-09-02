"use client";

import { useEffect, useRef } from "react";
import { X, Mail, CalendarDays, MessageSquare } from "lucide-react";
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-[2px] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
      onMouseDown={closeSupport}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "relative flex flex-col w-full bg-white shadow-2xl outline-none sm:rounded-2xl",
          "rounded-t-2xl sm:rounded-t-2xl",
          "h-[88vh] sm:h-auto sm:max-h-[88vh]",
          activeTab === "booking" ? "sm:max-w-[800px]" : "sm:max-w-[700px]",
          "animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeSupport();
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-muted">Support</p>
            <h2 id="support-modal-title" className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              How can we help?
            </h2>
          </div>
          <button
            onClick={closeSupport}
            className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Close support modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="shrink-0 border-b border-line bg-surface/30 px-5 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <button
              onClick={() => setActiveTab("email")}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                activeTab === "email"
                  ? "border-brand bg-brand/5 shadow-sm ring-1 ring-brand/20"
                  : "border-line bg-white hover:border-brand/40 hover:bg-surface"
              )}
            >
              <div className={cn("mt-0.5 rounded-lg p-2 transition-colors", activeTab === "email" ? "bg-brand/10 text-brand" : "bg-surface text-muted group-hover:text-ink")}>
                <Mail size={18} />
              </div>
              <div>
                <div className={cn("font-semibold text-sm", activeTab === "email" ? "text-brand" : "text-ink")}>Email</div>
                <div className="text-xs text-muted mt-0.5">Write to us anytime</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("booking")}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                activeTab === "booking"
                  ? "border-brand bg-brand/5 shadow-sm ring-1 ring-brand/20"
                  : "border-line bg-white hover:border-brand/40 hover:bg-surface"
              )}
            >
              <div className={cn("mt-0.5 rounded-lg p-2 transition-colors", activeTab === "booking" ? "bg-brand/10 text-brand" : "bg-surface text-muted group-hover:text-ink")}>
                <CalendarDays size={18} />
              </div>
              <div>
                <div className={cn("font-semibold text-sm", activeTab === "booking" ? "text-brand" : "text-ink")}>Book a call</div>
                <div className="text-xs text-muted mt-0.5">Pick a time that suits</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("feedback")}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                activeTab === "feedback"
                  ? "border-brand bg-brand/5 shadow-sm ring-1 ring-brand/20"
                  : "border-line bg-white hover:border-brand/40 hover:bg-surface"
              )}
            >
              <div className={cn("mt-0.5 rounded-lg p-2 transition-colors", activeTab === "feedback" ? "bg-brand/10 text-brand" : "bg-surface text-muted group-hover:text-ink")}>
                <MessageSquare size={18} />
              </div>
              <div>
                <div className={cn("font-semibold text-sm", activeTab === "feedback" ? "text-brand" : "text-ink")}>Feedback</div>
                <div className="text-xs text-muted mt-0.5">Report bugs or ideas</div>
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="animate-in fade-in duration-200">
            {activeTab === "email" && <EmailSupport />}
            {activeTab === "booking" && <BookingSupport />}
            {activeTab === "feedback" && <FeedbackSupport />}
          </div>
        </div>
      </div>
    </div>
  );
}
