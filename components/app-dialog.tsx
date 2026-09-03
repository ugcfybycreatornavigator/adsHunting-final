"use client";

/**
 * AppDialog — centered info/confirm dialog built on top of ModalShell.
 * Used for one-off alerts, confirmations, and "coming soon" notices.
 */
import { type ReactNode } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui";

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: "primary" | "signal" | "secondary";
  onConfirm?: () => void;
  dismissLabel?: string;
  className?: string;
}

export function AppDialog({
  open,
  onClose,
  title,
  icon,
  children,
  confirmLabel,
  confirmVariant = "signal",
  onConfirm,
  dismissLabel = "Got it",
  className,
}: AppDialogProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      headerIcon={icon}
      maxWidth="max-w-sm"
      className={className}
    >
      <div className="p-5 sm:p-6">
        {children && (
          <div className="text-[14px] leading-relaxed text-zinc-600 space-y-2">
            {children}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          {confirmLabel && onConfirm ? (
            <>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                {dismissLabel === "Got it" ? "Cancel" : dismissLabel}
              </button>
              <Button
                variant={confirmVariant}
                className="w-full sm:w-auto h-[38px] text-[13px]"
                onClick={() => { onConfirm(); onClose(); }}
              >
                {confirmLabel}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className="w-full sm:w-auto h-[38px] text-[13px]"
              onClick={onClose}
            >
              {dismissLabel}
            </Button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
