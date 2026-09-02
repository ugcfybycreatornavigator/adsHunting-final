import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "signal" | "secondary" | "ghost" }) {
  return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50", {
    "bg-brand text-white hover:bg-brand-strong": variant === "primary",
    "bg-signal text-white hover:bg-signal-dark": variant === "signal",
    "border border-line bg-white text-ink hover:bg-surface": variant === "secondary",
    "text-muted hover:bg-surface hover:text-ink": variant === "ghost",
  }, className)} {...props} />;
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "red" | "dark" | "brand"; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none", tone === "red" && "bg-red-50 text-signal", tone === "brand" && "bg-brand/10 text-brand border border-brand/20", tone === "dark" && "bg-black text-white", tone === "neutral" && "bg-surface text-muted", className)}>{children}</span>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-card border border-line bg-white shadow-card", className)} {...props} />; }

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 text-center">
    {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-surface text-muted">{icon}</div>}
    <h3 className="font-semibold text-ink">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-muted">{body}</p>{action && <div className="mt-5">{action}</div>}
  </div>;
}

export function Skeleton({ className }: { className?: string }) { return <div className={cn("animate-pulse rounded-lg bg-surface", className)} />; }

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand">{eyebrow}</p>}<h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p></div>{actions && <div className="shrink-0">{actions}</div>}
  </div>;
}
