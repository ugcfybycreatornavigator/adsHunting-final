"use client";

/**
 * ModalShell — the single, consistent wrapper for every popup / modal in the app.
 *
 * Usage:
 *   <ModalShell open={open} onClose={onClose} title="Title" description="Sub-text">
 *     {body content}
 *   </ModalShell>
 *
 * Features:
 *   - Blurred, dark backdrop
 *   - Smooth fade + zoom-in animation
 *   - Bottom-sheet on mobile, centered dialog on desktop
 *   - Escape key to close
 *   - Body scroll lock while open
 *   - Accessible role="dialog" / aria-modal
 */

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Optional element slotted before the title (e.g. an icon badge) */
  headerIcon?: ReactNode;
  children?: ReactNode;
  /** Max width of the panel (default: max-w-md = 448px) */
  maxWidth?: string;
  className?: string;
}

export function ModalShell({
  open,
  onClose,
  title,
  description,
  headerIcon,
  children,
  maxWidth = "max-w-md",
  className,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Body scroll lock */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          // base
          "relative z-10 flex flex-col w-full bg-white outline-none",
          // mobile: bottom sheet
          "rounded-t-2xl",
          // desktop: centered card
          "sm:rounded-2xl sm:shadow-2xl sm:border sm:border-zinc-200/80",
          // animation
          "animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200",
          maxWidth,
          className
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description || headerIcon) && (
          <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 sm:py-5 shrink-0">
            {headerIcon && (
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
                {headerIcon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-[15px] font-semibold text-zinc-900 leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
