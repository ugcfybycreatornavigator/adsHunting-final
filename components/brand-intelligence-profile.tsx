"use client";

import { useState } from "react";
import { CompetitorIntelligence } from "@/lib/brand-data";
import { DiscoverExperience } from "@/components/discover-experience";
import { safeExternalUrl } from "@/lib/utils";
import { Check, Plus, Loader2 } from "lucide-react";

export function BrandIntelligenceProfile({
  data,
  initialTracking,
}: {
  data: CompetitorIntelligence;
  initialTracking: boolean;
}) {
  const [tab, setTab] = useState<"overview" | "ads" | "activity">("overview");
  const [tracking, setTracking] = useState(initialTracking);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const initial = data.brandName?.slice(0, 1).toUpperCase() || "B";
  const avatar = safeExternalUrl(data.logoUrl);

  async function toggleTracking() {
    setTrackingBusy(true);
    try {
      if (tracking) {
        const response = await fetch(`/api/competitors?advertiser_id=${encodeURIComponent(data.advertiserId)}`, {
          method: "DELETE",
        });
        if (response.ok) setTracking(false);
      } else {
        const response = await fetch("/api/competitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advertiserId: data.advertiserId,
            advertiserName: data.brandName,
            advertiserAvatarUrl: data.logoUrl,
          }),
        });
        if (response.ok) setTracking(true);
      }
    } finally {
      setTrackingBusy(false);
    }
  }

  return (
    <div className="flex flex-col w-full">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-line">
        <div className="flex gap-5 items-start">
          {avatar ? (
            <img
              src={avatar}
              alt={data.brandName}
              className="size-20 shrink-0 rounded-full border border-line object-cover bg-white shadow-sm"
            />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-black text-2xl font-bold text-white shadow-sm">
              {initial}
            </span>
          )}
          <div className="flex flex-col pt-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">{data.brandName}</h1>
            <p className="mt-1 text-sm font-medium text-muted">
              {data.platforms && data.platforms.length > 0
                ? data.platforms
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(" · ")
                : "Cross Platform"}
            </p>
            <div className="flex gap-5 mt-4">
              <div className="flex flex-col">
                <span className="text-xl font-bold text-brand leading-none">{data.activeAds}</span>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1">Active Ads</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-ink leading-none">{data.totalAds}</span>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1">Total Ads</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-ink leading-none">{data.averageRunningDays || data.longestRunningDays || 0}d</span>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider mt-1">Avg. Running</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={toggleTracking}
          disabled={trackingBusy}
          className={`flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all ${
            tracking
              ? "bg-brand-soft text-brand-active hover:bg-brand-soft/80"
              : "bg-brand text-white hover:bg-brand-hover shadow-sm"
          }`}
        >
          {trackingBusy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : tracking ? (
            <>
              <Check size={16} /> Tracking
            </>
          ) : (
            <>
              <Plus size={16} /> Track Competitor
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-line mt-2">
        {(["overview", "ads", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-4 pt-4 text-sm font-semibold capitalize transition-colors relative ${
              tab === t ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="py-8">
        {tab === "overview" && <OverviewTab data={data} />}
        {tab === "ads" && <DiscoverExperience brandId={data.advertiserId} source="competitor" hideHeader={true} />}
        {tab === "activity" && <ActivityTab data={data} />}
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: CompetitorIntelligence }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Active Ads</p>
          <p className="text-2xl font-bold text-ink">{data.activeAds}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Unique Ads</p>
          <p className="text-2xl font-bold text-ink">{data.uniqueAds}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Longest Running</p>
          <p className="text-2xl font-bold text-ink">{data.longestRunningDays || 0} days</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">First Seen</p>
          <p className="text-2xl font-bold text-ink">{data.firstSeenAt ? new Date(data.firstSeenAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : "N/A"}</p>
        </div>
      </div>

      {data.latestCreatives?.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-ink mb-4">Top Creatives</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {data.latestCreatives.map((preview) => (
              <div key={preview.id} className="relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden border border-line">
                <img src={preview.url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ data }: { data: CompetitorIntelligence }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-ink mb-6">Recent Activity</h2>
      <div className="flex flex-col gap-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-line">
        <div className="relative pl-8">
          <span className="absolute left-0 top-1.5 size-6 rounded-full border-[4px] border-white bg-brand shadow-sm" />
          <p className="text-sm font-bold text-ink">Tracking started</p>
          <p className="text-sm text-muted mt-1">Began monitoring creative activity for {data.brandName}.</p>
          <p className="text-xs text-muted mt-2 font-medium">Recently</p>
        </div>
        <div className="relative pl-8">
          <span className="absolute left-0 top-1.5 size-6 rounded-full border-[4px] border-white bg-zinc-300 shadow-sm" />
          <p className="text-sm font-bold text-ink">{data.totalAds} ads discovered</p>
          <p className="text-sm text-muted mt-1">Historically cataloged {data.totalAds} distinct creative variants.</p>
          <p className="text-xs text-muted mt-2 font-medium">Historical</p>
        </div>
      </div>
    </div>
  );
}
