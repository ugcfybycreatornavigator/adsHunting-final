"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { mutate } from "swr";
import {
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, EmptyState } from "@/components/ui";
import { CompetitorIntelligence } from "@/lib/brand-data";
import { safeExternalUrl } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function CompetitorDashboard({ initialBrands }: { initialBrands: CompetitorIntelligence[] }) {
  const [brands, setBrands] = useState(initialBrands);
  const [adding, setAdding] = useState(false);

  const handleRefresh = useCallback(async (advertiserId: string, competitorId: string) => {
    // Optimistic: set syncing
    setBrands(prev =>
      prev.map(b => b.advertiserId === advertiserId ? { ...b, syncStatus: "syncing" } : b)
    );
    try {
      const res = await fetch("/api/competitors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: competitorId, action: "refresh" }),
      });
      if (res.ok) {
        // Reload page to get fresh server-rendered data
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setBrands(prev =>
          prev.map(b => b.advertiserId === advertiserId ? { ...b, syncStatus: "error", syncError: data.error || "Refresh failed." } : b)
        );
      }
    } catch {
      setBrands(prev =>
        prev.map(b => b.advertiserId === advertiserId ? { ...b, syncStatus: "error", syncError: "Refresh failed. Check your connection and retry." } : b)
      );
    }
  }, []);

  const handlePauseResume = useCallback(async (advertiserId: string, competitorId: string, isPaused: boolean) => {
    const action = isPaused ? "resume" : "pause";
    let previousBrands: CompetitorIntelligence[] = [];
    setBrands(prev => {
      previousBrands = prev;
      return prev.map(b => b.advertiserId === advertiserId
        ? { ...b, competitorStatus: isPaused ? "tracking" : "paused" }
        : b
      );
    });

    try {
      const res = await fetch("/api/competitors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: competitorId, action }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      mutate("/api/competitors");
    } catch (err) {
      console.error("[CompetitorDashboard] Pause/Resume error, rolling back:", err);
      setBrands(previousBrands);
    }
  }, []);

  const handleRemove = useCallback(async (advertiserId: string, competitorId: string) => {
    if (!confirm("Stop tracking this competitor? Their saved ads will remain in your library.")) return;

    let previousBrands: CompetitorIntelligence[] = [];
    setBrands(prev => {
      previousBrands = prev;
      return prev.filter(b => b.advertiserId !== advertiserId);
    });

    try {
      const res = await fetch(`/api/competitors?id=${competitorId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete competitor");
      mutate("/api/competitors");
    } catch (err) {
      console.error("[CompetitorDashboard] Remove error, rolling back:", err);
      setBrands(previousBrands);
      alert("Failed to remove competitor. Please try again.");
    }
  }, []);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Your Competitors</h2>
          <p className="text-sm font-medium text-muted mt-1">{brands.length} tracked</p>
        </div>
        {brands.length > 0 && (
          <Button
            variant="primary"
            className="bg-brand hover:bg-brand-hover text-white flex-shrink-0"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} /> Add Competitor
          </Button>
        )}
      </div>

      {brands.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {brands.map((brand) => (
            <CompetitorCard
              key={brand.advertiserId}
              brand={brand}
              onRefresh={handleRefresh}
              onPauseResume={handlePauseResume}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users />}
          title="No competitors tracked yet"
          body="Track brands to monitor their newest ads, creative launches and long-running winners."
          action={
            <Button
              variant="primary"
              className="bg-brand hover:bg-brand-hover text-white"
              onClick={() => setAdding(true)}
            >
              <Plus size={16} /> Add Competitor
            </Button>
          }
        />
      )}

      {adding && (
        <AddCompetitorModal
          trackedIds={new Set(brands.map(b => b.advertiserId))}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

// ─── Competitor Card ────────────────────────────────────────────────────────

type CardProps = {
  brand: CompetitorIntelligence;
  onRefresh: (advertiserId: string, competitorId: string) => void;
  onPauseResume: (advertiserId: string, competitorId: string, isPaused: boolean) => void;
  onRemove: (advertiserId: string, competitorId: string) => void;
};

function CompetitorCard({ brand, onRefresh, onPauseResume, onRemove }: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = brand.brandName?.slice(0, 1).toUpperCase() || "B";
  const avatar = safeExternalUrl(brand.logoUrl);

  // Determine card state
  const isSyncing = brand.syncStatus === "syncing";
  const isSyncError = brand.syncStatus === "error";
  const isPaused = brand.competitorStatus === "paused";
  const neverSynced = brand.adsCount === -1;
  const isLoading = isSyncing || neverSynced;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Status badge
  const statusBadge = isPaused ? (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="flex size-1.5 rounded-full bg-zinc-400" />
      <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Paused</p>
    </div>
  ) : isSyncError ? (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="flex size-1.5 rounded-full bg-red-500" />
      <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Error</p>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="flex size-1.5 rounded-full bg-brand" />
      <p className="text-[11px] font-bold text-brand uppercase tracking-wider">Tracking</p>
    </div>
  );

  return (
    <article className={cn(
      "group relative flex flex-col w-full rounded-[16px] border border-line bg-white transition-all duration-200 hover:border-brand/30 hover:shadow-sm",
      menuOpen ? "z-50 overflow-visible" : "overflow-hidden z-10"
    )}>
      <div className="flex flex-col p-5 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3">
          {avatar ? (
            <img
              src={avatar}
              alt={brand.brandName}
              className="size-11 shrink-0 rounded-full border border-line object-cover bg-zinc-50"
              loading="lazy"
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-800 text-sm font-bold text-white">
              {initial}
            </span>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold text-ink">{brand.brandName}</h3>
              {/* Menu button */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-zinc-100 hover:text-ink transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Competitor actions"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-line bg-white shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <Link
                      href={`/competitors/${encodeURIComponent(brand.advertiserId)}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-ink hover:bg-zinc-50 transition w-full"
                    >
                      <ChevronRight size={14} className="text-muted" /> View Intelligence
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); onRefresh(brand.advertiserId, brand.competitorId); }}
                      disabled={isSyncing}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-ink hover:bg-zinc-50 transition w-full disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={`text-muted ${isSyncing ? 'animate-spin' : ''}`} /> 
                      {isSyncing ? "Syncing…" : "Refresh Now"}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onPauseResume(brand.advertiserId, brand.competitorId, isPaused); }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-ink hover:bg-zinc-50 transition w-full"
                    >
                      {isPaused ? <Play size={14} className="text-muted" /> : <Pause size={14} className="text-muted" />}
                      {isPaused ? "Resume Tracking" : "Pause Tracking"}
                    </button>
                    <div className="border-t border-line my-1" />
                    <button
                      onClick={() => { setMenuOpen(false); onRemove(brand.advertiserId, brand.competitorId); }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition w-full"
                    >
                      <Trash2 size={14} /> Remove Competitor
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="truncate text-[13px] text-muted">{brand.category || "Advertiser"}</p>
            {statusBadge}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5 mb-5">
          <div className="flex flex-col">
            {isLoading ? (
              <span className="h-6 w-10 rounded bg-zinc-100 animate-pulse" />
            ) : (
              <span className="text-[20px] font-semibold text-ink">{brand.activeAds}</span>
            )}
            <span className="text-[11px] text-muted font-medium mt-0.5">Active Ads</span>
          </div>
          <div className="flex flex-col">
            {isLoading ? (
              <span className="h-6 w-10 rounded bg-zinc-100 animate-pulse" />
            ) : (
              <span className="text-[20px] font-semibold text-ink">{brand.uniqueAds}</span>
            )}
            <span className="text-[11px] text-muted font-medium mt-0.5">Unique Ads</span>
          </div>
          <div className="flex flex-col">
            {isLoading ? (
              <span className="h-6 w-10 rounded bg-zinc-100 animate-pulse" />
            ) : (
              <span className={`text-[20px] font-semibold ${brand.newAdsThisWeek > 0 ? "text-brand" : "text-ink"}`}>
                {brand.newAdsThisWeek > 0 ? `+${brand.newAdsThisWeek}` : brand.newAdsThisWeek}
              </span>
            )}
            <span className="text-[11px] text-muted font-medium mt-0.5">This Week</span>
          </div>
        </div>

        {/* Creatives Preview */}
        <p className="text-[13px] font-semibold text-ink mb-2">Latest Creatives</p>
        {isLoading ? (
          <div className="flex gap-2 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex-1 aspect-square bg-zinc-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : brand.latestCreatives && brand.latestCreatives.length > 0 ? (
          <div className="flex gap-2 mb-4">
            {brand.latestCreatives.slice(0, 4).map((preview, i) => (
              <div
                key={preview.id || i}
                className="flex-1 relative aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-line/50 hover:border-line transition"
              >
                <img
                  src={preview.url}
                  alt={`${brand.brandName} creative preview ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {preview.type === "video" && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    VIDEO
                  </div>
                )}
                {preview.type === "carousel" && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    ⧉
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : isSyncError ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100 mb-4">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-600 font-medium" title={brand.syncError || undefined}>Couldn&apos;t fetch creatives.</span>
            <button
              onClick={() => onRefresh(brand.advertiserId, brand.competitorId)}
              className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center p-4 bg-zinc-50 rounded-lg border border-line/50 mb-4">
            <span className="text-xs text-muted font-medium">
              {brand.activeAds === 0 ? "No currently active ads detected." : "No creatives discovered yet."}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[12px] mt-auto pt-3 border-t border-line/50">
          <span className="text-muted font-medium">
            {isSyncing ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Syncing…
              </span>
            ) : brand.lastSyncedAt ? (
              `Synced ${timeAgo(brand.lastSyncedAt)}`
            ) : brand.lastActivityAt ? (
              `Last activity ${timeAgo(brand.lastActivityAt)}`
            ) : (
              "Awaiting first sync"
            )}
          </span>
          <Link
            href={`/competitors/${encodeURIComponent(brand.advertiserId)}`}
            className="flex items-center gap-1 font-semibold text-ink transition hover:text-brand"
          >
            View Intelligence <ChevronRight size={14} className="opacity-70" />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Add Competitor Modal ───────────────────────────────────────────────────

type Candidate = { id: string; name: string; avatar: string | null; activeAds: number };

function AddCompetitorModal({ 
  onClose, 
  onAdded,
  trackedIds 
}: { 
  onClose: () => void; 
  onAdded: () => void;
  trackedIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setSearched(false);
    setError("");
    setFailedLogos(new Set());

    try {
      const response = await fetch("/api/brands/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || data.error || "Search failed.");
        setBusy(false);
        return;
      }

      const map = new Map<string, Candidate>();
      (data.brands || []).forEach((brand: { id: string; name?: string; avatar?: string | null; activeUnique?: number }) => {
        if (!map.has(brand.id)) {
          map.set(brand.id, {
            id: brand.id,
            name: brand.name || "Unknown",
            avatar: brand.avatar || null,
            activeAds: brand.activeUnique || 0,
          });
        }
      });

      // Sort: exact name matches first, then by active ads
      const candidates = [...map.values()];
      const qLower = q.toLowerCase();
      candidates.sort((a, b) => {
        const aExact = a.name.toLowerCase() === qLower ? 1 : 0;
        const bExact = b.name.toLowerCase() === qLower ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
        const aPrefix = a.name.toLowerCase().startsWith(qLower) ? 1 : 0;
        const bPrefix = b.name.toLowerCase().startsWith(qLower) ? 1 : 0;
        if (bPrefix !== aPrefix) return bPrefix - aPrefix;
        return b.activeAds - a.activeAds;
      });

      setResults(candidates.slice(0, 6));
      setSearched(true);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "Search failed.");
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setBusy(true); // show loading state immediately while debouncing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  async function track(candidate: Candidate) {
    if (trackedIds.has(candidate.id)) return;
    setTracking(candidate.id);
    setError("");

    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserId: candidate.id,
          advertiserName: candidate.name,
          advertiserAvatarUrl: candidate.avatar,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add competitor.");
        return;
      }

      onAdded();
    } catch (err) {
      setError((err as Error).message || "An error occurred.");
    } finally {
      setTracking(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end bg-black/25 sm:place-items-center sm:p-4 backdrop-blur-sm transition-opacity"
      onMouseDown={onClose}
    >
      <div
        className="w-full rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl shadow-xl border border-line"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Add competitor</h2>
            <p className="mt-1 text-xs font-medium text-muted">Search brands or advertisers to start tracking.</p>
          </div>
          <button onClick={onClose} className="grid size-10 place-items-center text-muted hover:text-ink transition">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nike, Gymshark, Glossier…"
            className="h-11 w-full rounded-lg border border-line pl-9 pr-10 text-sm outline-none focus:border-brand shadow-sm transition"
          />
          {busy && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-muted" />
            </div>
          )}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 font-medium">{error}</p>}

        <div className="mt-5 min-h-[160px] max-h-[60vh] overflow-y-auto">
          {busy && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-[160px] text-muted space-y-3">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm font-medium">Searching advertisers...</p>
            </div>
          )}

          <div className="space-y-2">
          {results.map((candidate) => {
            const isTracked = trackedIds.has(candidate.id);
            const isTracking = tracking === candidate.id;
            return (
              <div
                key={candidate.id}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 hover:border-brand/30 hover:bg-brand-soft transition"
              >
                {candidate.avatar && !failedLogos.has(candidate.id) ? (
                  <img
                    src={candidate.avatar}
                    alt={`${candidate.name} logo`}
                    onError={() => setFailedLogos(prev => new Set(prev).add(candidate.id))}
                    className="size-10 flex-shrink-0 rounded-full border border-line/50 object-cover bg-zinc-50"
                  />
                ) : (
                  <span className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-zinc-800 text-xs font-bold text-white">
                    {candidate.name[0]?.toUpperCase() || "B"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{candidate.name}</span>
                  <span className="text-[12px] text-muted font-medium mt-0.5">
                    {candidate.activeAds} active ad{candidate.activeAds !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => track(candidate)}
                  disabled={isTracked || isTracking}
                  className={`flex h-[34px] flex-shrink-0 items-center justify-center gap-1.5 rounded-md px-3.5 text-[13px] font-bold transition ${
                    isTracked
                      ? "bg-brand text-white cursor-default"
                      : isTracking
                      ? "bg-zinc-100 text-muted cursor-wait"
                      : "bg-white border border-line text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {isTracked ? (
                    <>
                      <Check size={14} /> Tracking
                    </>
                  ) : isTracking ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Track"
                  )}
                </button>
              </div>
            );
          })}

          </div>

          {!busy && searched && query.trim().length >= 2 && results.length === 0 && !error && (
            <div className="flex h-[160px] items-center justify-center text-center text-sm text-muted">
              No advertisers found for &ldquo;{query.trim()}&rdquo;
            </div>
          )}

          {!busy && !searched && query.trim().length < 2 && results.length === 0 && (
            <div className="flex h-[160px] items-center justify-center text-center text-sm text-muted">
              Search brands or advertisers to start tracking.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
