"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, MoreHorizontal, LogOut, Settings, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/nextjs";
import { useSupport } from "@/components/support/support-context";
import { useCredits } from "@/components/billing/CreditsContext";
import { navigationConfig } from "@/lib/navigation";
import { SidebarSwipeFiles } from "@/components/sidebar-swipe-files";

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <BrandMark compact />
        <button
          aria-label="Open navigation"
          className="flex size-10 items-center justify-center rounded-lg border border-line text-ink"
          onClick={() => setOpen(true)}
        >
          <Menu size={20} />
        </button>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-[min(88vw,300px)] flex-col bg-white px-4 pb-4 border-r border-[#E1E1E1] animate-in slide-in-from-left duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[72px] shrink-0 items-center justify-between pl-3 pr-1 pt-4">
              <BrandMark />
              <button
                aria-label="Close navigation"
                className="flex size-10 items-center justify-center text-[#A1A1AA] hover:text-[#111216] transition"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pt-4 scrollbar-hide flex flex-col gap-[8px]">
              <Navigation onNavigate={() => setOpen(false)} />
            </div>
            
            <div className="mt-4 shrink-0 border-t border-[#E1E1E1] pt-4 flex flex-col gap-[2px]">
              <SupportNavigation onNavigate={() => setOpen(false)} />
              <SidebarCredits />
              <SidebarProfile />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-[#E1E1E1] bg-white px-4 pb-4 lg:flex">
      <div className="flex h-[68px] shrink-0 items-center pl-3 pt-4">
        <BrandMark />
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-[12px] scrollbar-hide flex flex-col gap-[8px]">
        <Navigation />
      </div>
      
      <div className="mt-4 shrink-0 border-t border-[#E1E1E1] pt-4 flex flex-col gap-[2px]">
        <SupportNavigation />
        <SidebarCredits />
        <SidebarProfile />
      </div>
    </aside>
  );
}

function NavItem({ 
  label, href, icon: Icon, onNavigate, aliases 
}: { 
  label: string, href: string, icon: React.ElementType, onNavigate?: () => void, aliases?: string[]
}) {
  const pathname = usePathname();
  const active = pathname === href || 
    (href !== '/dashboard' && pathname.startsWith(`${href}/`)) ||
    aliases?.some(alias => pathname === alias || pathname.startsWith(`${alias}/`));
  
  return (
    <Link
      onClick={onNavigate}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[36px] items-center gap-[11px] rounded-[10px] px-3 transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white",
        active
          ? "bg-gradient-to-r from-[#68B32F] to-[#569b24] text-white font-semibold shadow-sm"
          : "text-[#71717A] font-medium hover:bg-[#F7F7F8] hover:text-[#18181B]"
      )}
    >
      <Icon size={17} strokeWidth={1.8} className={cn("shrink-0 transition-colors duration-150", active ? "text-white" : "text-[#A1A1AA] group-hover:text-[#52525B]")} />
      <span className="truncate text-[13.5px]">{label}</span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-[8px]">
      {/* Primary: Home, Discover */}
      <div className="flex flex-col gap-[2px]">
        {navigationConfig.primary.map((item) => (
          <NavItem key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Research Group (No Heading, just grouped by spacing) */}
      <div className="flex flex-col gap-[2px]">
        {navigationConfig.research.map((item) => (
          <NavItem key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Organization: Swipe Files (Saved Ads is inside) */}
      <div className="flex flex-col gap-[2px]">
        <SidebarSwipeFiles onNavigate={onNavigate} isMobile={!!onNavigate} />
      </div>
      
      {/* Shared Ads */}
      <div className="flex flex-col gap-[2px]">
        {navigationConfig.shared.map((item) => (
          <NavItem key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

function SupportNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { openSupport } = useSupport();
  const pathname = usePathname();

  return (
    <nav aria-label="Support navigation" className="flex flex-col mb-1 gap-[2px]">
      {navigationConfig.support.map((item) => {
        if (item.isModal) {
          return (
            <button
              key={item.label}
              onClick={() => {
                if (onNavigate) onNavigate();
                openSupport();
              }}
              className="group relative flex w-full h-[34px] items-center gap-[11px] rounded-[10px] px-3 transition-all duration-150 ease-out outline-none text-[#71717A] hover:bg-[#F7F7F8] hover:text-[#18181B] border border-transparent focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white"
            >
              <item.icon size={17} strokeWidth={1.8} className="shrink-0 transition-colors duration-150 text-[#A1A1AA] group-hover:text-[#52525B]" />
              <span className="truncate font-medium text-[13.5px]">{item.label}</span>
            </button>
          );
        }
        
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            onClick={onNavigate}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-[34px] items-center gap-[11px] rounded-[10px] px-3 transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white",
              active
                ? "bg-gradient-to-r from-[#68B32F] to-[#569b24] text-white font-semibold shadow-sm"
                : "text-[#71717A] font-medium hover:bg-[#F7F7F8] hover:text-[#18181B]"
            )}
          >
            <item.icon size={17} strokeWidth={1.8} className={cn("shrink-0 transition-colors duration-150", active ? "text-white" : "text-[#A1A1AA] group-hover:text-[#52525B]")} />
            <span className="truncate text-[13.5px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarProfile() {
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isLoaded) {
    return <div className="h-[48px] animate-pulse rounded-[12px] bg-[#E5E7EB]" />;
  }

  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress;
  const isOwner = email?.trim().toLowerCase() === "creatornavigator@gmail.com";

  return (
    <div className="relative w-full" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="group relative flex w-full items-center gap-3 rounded-[12px] pt-[8px] pb-[8px] px-[10px] transition duration-150 hover:bg-[#F7F7F8] bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white"
        style={isOpen ? { backgroundColor: "#F4F4F5" } : {}}
      >
        <div className="relative">
          <img
            src={user.imageUrl}
            alt={`${user.fullName || "User"} avatar`}
            className="size-[32px] shrink-0 rounded-full border border-black/10 object-cover bg-white"
          />
          {isOwner && (
            <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-[#68B32F] text-white ring-2 ring-white" title="Platform Owner">
              <ShieldCheck size={10} strokeWidth={2.5} />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <p className="truncate text-[13px] font-semibold text-[#18181B]">
            {user.fullName || email?.split('@')[0] || "User"}
          </p>
          <p className="truncate text-[11px] font-medium text-[#71717A] flex items-center gap-1">
            {isOwner ? (
              <span className="text-[#529322] font-semibold">Platform Owner</span>
            ) : (
              "Personal account"
            )}
          </p>
        </div>
        <MoreHorizontal size={16} className={cn("transition-colors", isOpen ? "text-[#18181B]" : "text-[#A1A1AA] group-hover:text-[#52525B]")} />
      </button>

      {isOpen && (
        <div 
          className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-[260px] rounded-[14px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-100"
          role="menu"
        >
          <div className="flex items-center gap-3 px-2 pb-3 pt-2">
            <div className="relative">
              <img src={user.imageUrl} alt={`${user.fullName || "User"} avatar`} className="size-[36px] rounded-full border border-line object-cover bg-zinc-50" />
              {isOwner && (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-[#68B32F] text-white ring-2 ring-white">
                  <ShieldCheck size={11} strokeWidth={2.5} />
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[13.5px] font-semibold text-[#18181B] flex items-center gap-1.5">
                {user.fullName || "User"}
              </span>
              <span className="truncate text-[12px] text-[#71717A]">
                {email}
              </span>
              {isOwner && (
                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded bg-[#68B32F]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#529322]">
                  <ShieldCheck size={11} /> OWNER
                </span>
              )}
            </div>
          </div>
          <div className="h-px w-full bg-[#ECEDEF] my-1" />
          <div className="flex flex-col gap-0.5">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-[#3F3F46] transition hover:bg-[#F5F5F6] hover:text-[#18181B] group outline-none focus-visible:ring-2 focus-visible:ring-signal"
              role="menuitem"
            >
              <Settings size={16} className="text-[#71717A] group-hover:text-[#18181B] transition" />
              Manage account
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-[#3F3F46] transition hover:bg-[#FFF1F2] hover:text-[#DC2626] group outline-none focus-visible:ring-2 focus-visible:ring-signal"
              role="menuitem"
            >
              <LogOut size={16} className="text-[#71717A] group-hover:text-[#DC2626] transition" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarCredits() {
  const { state } = useCredits();
  if (!state) return null;

  const pct = state.unlimited ? 0 : Math.max(0, Math.min(100, ((state.creditsUsed || 0) / (state.creditsAllocated || 1)) * 100));

  return (
    <Link href="/settings/billing" className="group flex flex-col gap-1.5 px-3 py-2 mb-2 rounded-[12px] hover:bg-[#F7F7F8] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#18181B]">Credits</span>
        <span className="text-[11px] font-medium text-[#71717A] tabular-nums group-hover:text-[#18181B] transition-colors">
          {state.unlimited ? (
            <span className="text-[#68B32F] font-semibold">Unlimited</span>
          ) : (
            `${state.creditsRemaining !== null && state.creditsRemaining >= 1000 ? (state.creditsRemaining / 1000).toFixed(1) + 'K' : (state.creditsRemaining || 0)} / ${state.creditsAllocated !== null && state.creditsAllocated >= 1000 ? (state.creditsAllocated / 1000).toFixed(0) + 'K' : (state.creditsAllocated || 0)}`
          )}
        </span>
      </div>
      {!state.unlimited && (
        <div className="h-1.5 w-full bg-[#ECEDEF] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#68B32F] to-[#569b24] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </Link>
  );
}
