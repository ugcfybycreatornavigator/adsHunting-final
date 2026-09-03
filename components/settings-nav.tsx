"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, Settings, Bell, Users, CreditCard, Cpu, Webhook, LucideIcon } from "lucide-react";

type NavItem = { name: string; href: string; icon: LucideIcon; isSoon?: boolean };
const navGroups: NavItem[][] = [
  [
    { name: "General", href: "/settings", icon: Settings },
    { name: "Alerts", href: "/settings/alerts", icon: Bell },
  ],
  [
    { name: "Team", href: "/settings/team", icon: Users },
    { name: "Billing", href: "/settings/billing", icon: CreditCard },
  ],
  [
    { name: "MCP", href: "/settings/mcp", icon: Cpu, isSoon: true },
    { name: "API", href: "/settings/api", icon: Webhook, isSoon: true },
  ],
];

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Mobile select handler
  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(e.target.value);
  };

  const flatItems = navGroups.flat();

  return (
    <>
      {/* Mobile Nav */}
      <div className="md:hidden relative mb-6">
        <select
          value={pathname}
          onChange={handleSelect}
          className="w-full h-[44px] appearance-none rounded-[10px] border border-[#E1E1E1] bg-white px-3 pr-10 text-[14px] font-medium text-[#18181B] outline-none focus:ring-2 focus:ring-signal focus:ring-offset-1"
        >
          {flatItems.map((item) => (
            <option key={item.href} value={item.href}>
              {item.name} {item.isSoon ? "(Soon)" : ""}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A]">
          <ChevronDown size={16} />
        </div>
      </div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex w-[220px] lg:w-[240px] shrink-0 flex-col gap-6 sticky top-[32px]">
        <div className="flex flex-col gap-[16px]">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="flex flex-col gap-[2px]">
              {group.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex h-[36px] items-center justify-between rounded-[10px] px-3 transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1",
                      active
                        ? "bg-[#F4F4F5] text-[#18181B] font-semibold"
                        : "text-[#71717A] font-medium hover:bg-[#F7F7F8] hover:text-[#18181B]"
                    )}
                  >
                    <div className="flex items-center gap-[11px]">
                      <item.icon size={17} strokeWidth={1.8} className={cn("shrink-0 transition-colors duration-150", active ? "text-[#52525B]" : "text-[#A1A1AA] group-hover:text-[#52525B]")} />
                      <span className="truncate text-[13.5px]">{item.name}</span>
                    </div>
                    {item.isSoon && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-[#F4F4F5] text-[#71717A] border border-[#E1E1E1]">
                        Soon
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
