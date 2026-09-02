"use client";

import React, { useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X, Check, ChevronDown, ChevronUp } from "lucide-react";

// -- Hook for Portal --
function usePortal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? document.body : null;
}

// -- Primitive: Popover (Desktop) --
export function Popover({ 
  trigger, 
  children,
  open,
  onOpenChange,
  header,
  footer
}: { 
  trigger: ReactNode; 
  children: ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  header: ReactNode;
  footer: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const portalNode = usePortal();
  const [coords, setCoords] = useState({ top: 0, left: 0, maxHeight: 720 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !open) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    
    // Ideal: below the trigger
    let top = rect.bottom + 8;
    let maxH = Math.min(720, window.innerHeight - 140);

    // If not enough space below, and more space above, flip it
    if (spaceBelow < 400 && spaceAbove > spaceBelow) {
      top = Math.max(16, rect.top - maxH - 8);
      maxH = Math.min(maxH, spaceAbove - 8);
    } else {
      maxH = Math.min(maxH, spaceBelow - 8);
    }

    setCoords({
      top,
      left: Math.max(16, rect.left), // Align left, but at least 16px from edge
      maxHeight: maxH,
    });
  }, [open]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <div className="inline-block" ref={triggerRef} onClick={() => onOpenChange(!open)}>
        {trigger}
      </div>
      {open && portalNode && createPortal(
        <div 
          ref={popoverRef}
          style={{ 
            top: coords.top, 
            left: coords.left, 
            maxHeight: coords.maxHeight,
            width: "420px"
          }}
          className="fixed z-[100] flex flex-col rounded-[16px] border border-line bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex-none rounded-t-[16px] border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
            {children}
          </div>
          <div className="flex-none rounded-b-[16px] border-t border-line bg-white/95 px-5 py-4 backdrop-blur">
            {footer}
          </div>
        </div>,
        portalNode
      )}
    </>
  );
}

// -- Primitive: Sheet (Mobile Drawer) --
export function Sheet({ 
  open, 
  onClose, 
  children, 
  header,
  footer
}: { 
  open: boolean; 
  onClose: () => void; 
  children: ReactNode; 
  header: ReactNode;
  footer: ReactNode;
}) {
  const portalNode = usePortal();

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !portalNode) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:hidden h-[100dvh]">
      <div className="fixed inset-0 bg-black/40 transition-opacity animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative flex w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-xl animate-in slide-in-from-bottom-full duration-300 h-[92dvh] max-h-[92dvh]">
        <div className="flex-none rounded-t-[24px] border-b border-line bg-white px-5 py-4">
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-12 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {children}
        </div>
        <div className="flex-none border-t border-line bg-white px-5 py-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {footer}
        </div>
      </div>
    </div>,
    portalNode
  );
}

// -- Primitive: CheckboxItem --
export function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-brand-soft focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-1">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={cn("flex size-5 shrink-0 items-center justify-center rounded border transition", checked ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white")}>
        {checked && <Check size={14} strokeWidth={3} />}
      </div>
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

// -- Primitive: CollapsibleSection --
export function CollapsibleSection({ 
  title, 
  children,
  defaultExpanded = false,
  selectedCount = 0,
  summary = ""
}: { 
  title: string; 
  children: ReactNode;
  defaultExpanded?: boolean;
  selectedCount?: number;
  summary?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-line last:border-0">
      <button 
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between px-2 py-4 text-left transition focus:outline-none focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded-lg",
          expanded ? "bg-brand-soft/50" : "hover:bg-zinc-50"
        )}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-ink">{title}</span>
            {selectedCount > 0 && (
              <span className="grid min-w-[20px] place-items-center rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-active">
                {selectedCount}
              </span>
            )}
          </div>
          {summary && !expanded && (
            <span className="text-xs font-medium text-brand truncate max-w-[240px]">{summary}</span>
          )}
        </div>
        <div className="text-muted pr-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 p-2 pt-0 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

// -- Primitive: SelectButtonGroup (like radio but boxes) --
export function SelectButtonGroup({ options, value, onChange }: { options: {id: string; label: string}[]; value?: string | string[]; onChange: (val: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isSelected = Array.isArray(value) ? value.includes(opt.id) : value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand", 
              isSelected 
                ? "border-brand bg-brand-soft text-brand-active shadow-sm" 
                : "border-line bg-white text-muted hover:border-brand-border hover:bg-brand-soft/30 hover:text-ink"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// -- Primitive: SearchInput --
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3 mt-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface py-2 pl-3 pr-8 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-1 focus:ring-brand"
      />
      {value && (
        <button 
          onClick={() => onChange("")} 
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
