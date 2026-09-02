"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Link2, Users, Settings, Store } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import type { NormalizedAd } from "@/lib/types";
import { AdCard } from "@/components/ad-card";
import { AdDetailDrawer } from "@/components/ad-detail";
import { ShareModal } from "@/components/share-modal";
import { apiFetch } from "@/lib/api-client";

export function DashboardView({ data }: { data: DashboardData }) {
  const { user, actions, recent, mostSaved } = data;

  const [details, setDetails] = useState<NormalizedAd | null>(null);
  const [shareAdId, setShareAdId] = useState<string | null>(null);

  const currentHour = new Date().getHours();
  let greeting = "Good Evening";
  if (currentHour < 12) greeting = "Good Morning";
  else if (currentHour < 18) greeting = "Good Afternoon";

  const actionCards = [
    { title: "Saved Ads", count: actions.savedAds, href: actions.savedAdsHref, icon: Bookmark },
    { title: "Shared Links", count: actions.sharedAds, href: "/shared-ads", icon: Link2 },
    { title: "Tracked Competitors", count: actions.competitors, href: "/competitors", icon: Users },
    { title: "Brands", count: actions.brands, href: "/brands", icon: Store },
  ];

  const continueResearchItems = [...mostSaved, ...recent]
    .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
    .slice(0, 4);

  async function saveAd(ad: NormalizedAd) {
    try {
      await apiFetch("/api/swipe-files/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: ad.id, externalAdId: (ad.externalId || ad.id) }),
      });
    } catch (error) {
      console.error("Failed to save ad", error);
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-24 space-y-10">
      {/* 1. Hero / Header */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.02)]">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-5">
            {user?.imageUrl ? (
              <div className="relative">
                <img src={user.imageUrl} alt="Avatar" className="size-16 rounded-full object-cover shadow-sm ring-1 ring-black/10" />
                <div className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-white bg-[#68B32F]" />
              </div>
            ) : (
              <div className="relative">
                <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100 text-xl font-bold text-zinc-400 shadow-sm ring-1 ring-black/10">
                  {user?.firstName?.[0] || "?"}
                </div>
                <div className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-white bg-[#68B32F]" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {greeting}, {user?.firstName || "Welcome"}
              </h1>
              <p className="mt-1 text-[13.5px] text-zinc-500">Your Creative Intelligence Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200/80 bg-white px-4 text-[13px] font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98]">
              <Settings size={16} className="mr-2 text-zinc-400" /> Settings
            </Link>
            <Link href="/discover" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#68B32F] px-5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all hover:bg-[#5a9c29] hover:shadow-[0_2px_4px_rgba(104,179,47,0.2)] active:scale-[0.98]">
              Discover Ads
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Overview Metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {actionCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#68B32F]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] outline-none focus-visible:ring-2 focus-visible:ring-[#68B32F]"
          >
            <div className="absolute right-0 top-0 h-16 w-16 -translate-y-8 translate-x-8 rounded-full bg-[#68B32F]/5 blur-2xl transition-all duration-300 group-hover:bg-[#68B32F]/10" />
            <div className="flex items-center justify-between">
              <span className="flex size-[38px] items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-500 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 group-hover:bg-[#68B32F]/10 group-hover:text-[#68B32F] group-hover:border-[#68B32F]/20">
                <card.icon size={18} />
              </span>
            </div>
            <div className="mt-5">
              <p className="text-3xl font-bold tracking-tight text-zinc-900">
                {card.count == null ? "—" : card.count.toLocaleString()}
              </p>
              <h3 className="mt-1 text-[13px] font-medium text-zinc-500 group-hover:text-zinc-700 transition-colors">{card.title}</h3>
            </div>
          </Link>
        ))}
      </section>

      {/* 3. Continue Research / Recent Creatives */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">Continue Research</h2>
            <p className="mt-1 text-[13.5px] text-zinc-500">Pick up where you left off</p>
          </div>
          <Link href="/discover" className="text-[13px] font-semibold text-[#68B32F] transition-colors hover:text-[#5a9c29]">View all</Link>
        </div>
        
        {continueResearchItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {continueResearchItems.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onOpen={() => setDetails(ad)}
                onSave={() => saveAd(ad)}
                onShare={async () => setShareAdId(ad.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-[60px] text-center">
            <h3 className="text-[15px] font-semibold text-zinc-900">Start discovering winning creatives</h3>
            <p className="mt-1.5 max-w-sm text-[13px] text-zinc-500">Discover top performing ads and save them to build your research library.</p>
            <Link href="/discover" className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-[#68B32F] px-4 text-[13px] font-medium text-white transition hover:bg-[#5a9c29]">
              Discover Ads
            </Link>
          </div>
        )}
      </section>

      {/* 4. Getting Started / Resources */}
      <section className="space-y-5">
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">Getting Started</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/discover" className="group flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#68B32F]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-[#68B32F]/10 group-hover:text-[#68B32F]">
                <span className="text-[11px] font-bold">1</span>
              </div>
              <ArrowRight size={14} className="text-zinc-300 transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[#68B32F]" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-semibold text-zinc-900">Discover your first ad</h3>
              <p className="mt-1 text-[12px] text-zinc-500">Search brands, creatives and markets</p>
            </div>
          </Link>
          <Link href="/swipe-files" className="group flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#68B32F]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-[#68B32F]/10 group-hover:text-[#68B32F]">
                <span className="text-[11px] font-bold">2</span>
              </div>
              <ArrowRight size={14} className="text-zinc-300 transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[#68B32F]" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-semibold text-zinc-900">Save a creative</h3>
              <p className="mt-1 text-[12px] text-zinc-500">Add ads to your library for inspiration</p>
            </div>
          </Link>
          <Link href="/swipe-files" className="group flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#68B32F]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-[#68B32F]/10 group-hover:text-[#68B32F]">
                <span className="text-[11px] font-bold">3</span>
              </div>
              <ArrowRight size={14} className="text-zinc-300 transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[#68B32F]" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-semibold text-zinc-900">Create a Swipe File</h3>
              <p className="mt-1 text-[12px] text-zinc-500">Organize creatives into collections</p>
            </div>
          </Link>
          <Link href="/shared-ads" className="group flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#68B32F]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-[#68B32F]/10 group-hover:text-[#68B32F]">
                <span className="text-[11px] font-bold">4</span>
              </div>
              <ArrowRight size={14} className="text-zinc-300 transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[#68B32F]" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-semibold text-zinc-900">Share a collection</h3>
              <p className="mt-1 text-[12px] text-zinc-500">Generate a public link for your team</p>
            </div>
          </Link>
        </div>
      </section>

      {details && (
        <AdDetailDrawer
          ad={details}
          onClose={() => setDetails(null)}
          onSave={() => saveAd(details)}
        />
      )}
      
      {shareAdId && (
        <ShareModal 
          isOpen={true} 
          onClose={() => setShareAdId(null)} 
          adIds={[shareAdId]} 
          defaultName="Shared Ad" 
        />
      )}
    </div>
  );
}
