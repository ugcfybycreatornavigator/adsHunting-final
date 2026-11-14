"use client";
import { apiFetch } from "@/lib/api-client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Filter, Grid2X2, List, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { historyStorageKey, recentTerms } from "@/lib/search-suggestions";
import { AdCard } from "@/components/ad-card";
import { BrandCard } from "@/components/brand-card";
import { AdDetailDrawer } from "@/components/ad-detail";
import { type SwipeFileResult } from "@/components/swipe-file-picker";
import { ShareModal } from "@/components/share-modal";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { AdvancedFilters } from "@/components/filters/advanced-filters";
import { SavedFiltersPopover } from "@/components/filters/saved-filters";
import { SearchAutocomplete } from "@/components/search/search-autocomplete";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import type { AdSearchFilters, AdSearchResult, NormalizedAd } from "@/lib/types";
import type { BrandSummary } from "@/lib/brand-data";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";

const countries = [["ALL", "All countries"], ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["BR", "Brazil"]];
const defaults: AdSearchFilters = { query: "", status: "all", country: "ALL", platforms: [], mediaType: "all", cta: "", duration: "", startDate: "", endDate: "" };

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "relative flex size-9 sm:size-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-600 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#68B32F] focus-visible:ring-offset-2",
          open && "border-zinc-300 bg-zinc-50 text-zinc-900 ring-2 ring-zinc-200/60"
        )}
      >
        <Bell size={18} strokeWidth={2} className="transition-transform duration-150 active:scale-95" />
        <span
          className="absolute right-2 top-2 size-2 rounded-full bg-[#68B32F] ring-2 ring-white"
          title="Active monitoring"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications Panel"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-950/5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900">Notifications</h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">0 unread</span>
            </div>
            <Link
              href="/settings/alerts"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Settings
            </Link>
          </div>

          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="size-11 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 mb-2.5">
              <Bell size={18} strokeWidth={1.75} />
            </div>
            <p className="text-xs font-semibold text-zinc-800">You&apos;re all caught up</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px] leading-relaxed">
              No new alerts. Track competitors to receive updates when new ads are detected.
            </p>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-400">Competitor Alerts</span>
            <Link
              href="/settings/alerts"
              onClick={() => setOpen(false)}
              className="font-medium text-[#529322] hover:text-[#42791b] transition-colors flex items-center gap-1"
            >
              Configure alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function DiscoverExperience({ brandId, hideHeader = false }: { brandId?: string, hideHeader?: boolean }) {
  const { user } = useUser();
  const accountId = user?.id;
  const accountRef = useRef(accountId);
  const [historyOwner, setHistoryOwner] = useState<string | undefined>(undefined);
  const defaultFilters = useMemo(() => ({ ...defaults, brand: brandId }), [brandId]);
  const { filters, updateFilters: setFilters, clearFilters } = useUrlFilters(defaultFilters, { syncUrl: !hideHeader, readUrl: !hideHeader });
  const [ads, setAds] = useState<NormalizedAd[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<{ message: string } | null>(null);

  const [details, setDetails] = useState<NormalizedAd | null>(null);
  const [shareAdId, setShareAdId] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState(filters.query || "");
  const [sort, setSort] = useState("relevant");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [history, setHistory] = useState<string[]>([]);
  const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
  const [adCollectionIds, setAdCollectionIds] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" } | null>(null);
  const [deepLinkedAdId, setDeepLinkedAdId] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const searchSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    accountRef.current = accountId;
    setHistoryOwner(accountId);
    setHistory([]);
    try { if (accountId) setHistory(recentTerms(JSON.parse(localStorage.getItem(historyStorageKey(accountId)) || "[]"))); } catch { }
    if (typeof window !== "undefined") {
      setDeepLinkedAdId(new URLSearchParams(window.location.search).get("ad"));
    }
  }, [accountId]);

  useEffect(() => {
    let active = true;
    apiFetch("/api/swipe-files/ads")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const savedItems = Array.isArray(data?.items) ? data.items : [];
        const ids = new Set<string>();
        const collectionMap: Record<string, string[]> = {};
        for (const item of savedItems as { ad: NormalizedAd; collectionIds?: string[] }[]) {
          const id = item.ad.externalId || item.ad.id;
          ids.add(id);
          collectionMap[id] = item.collectionIds ?? [];
        }
        setSavedAdIds(ids);
        setAdCollectionIds(collectionMap);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const search = useCallback(async (nextFilters: AdSearchFilters, append = false) => {
    const searchAccount = accountRef.current;
    if (!append) {
      requestController.current?.abort();
      searchSessionIdRef.current = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const controller = new AbortController();
    requestController.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 35_000);

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const sessionId = nextFilters.sessionId || searchSessionIdRef.current || undefined;
      const response = await apiFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextFilters,
          sessionId,
        }),
        signal: controller.signal,
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        await response.text();
        throw { message: `Server returned an unexpected response (Status: ${response.status}).`, code: "SERVER_ERROR" };
      }

      if (!response.ok) {
        throw { message: data.message || data.error || "Search failed.", code: data.code };
      }
      const result = data as AdSearchResult;

      if (requestController.current !== controller) return;

      if (result.sessionId) {
        searchSessionIdRef.current = result.sessionId;
      }

      if (result.degraded) {
        setToast({ message: "Showing recently indexed results." });
      }

      if (result.resolvedIntent?.type === "advertiser" && nextFilters.brand !== result.resolvedIntent.advertiserId) {
        setFilters({ brand: result.resolvedIntent.advertiserId, query: result.resolvedIntent.advertiserName });
      }

      setAds(current => {
        if (!append) return result.ads;
        const dedup = new Map(current.map(ad => [ad.fingerprint || ad.id, ad]));
        for (const ad of result.ads) {
          const groupId = ad.fingerprint || ad.id;
          if (!dedup.has(groupId)) dedup.set(groupId, ad);
        }
        return Array.from(dedup.values());
      });
      setCursor(result.nextCursor);

      if (searchAccount && searchAccount === accountRef.current && (nextFilters.query?.trim() || result.resolvedIntent?.type === "advertiser")) {
        const queryToSave = result.resolvedIntent?.type === "advertiser" ? result.resolvedIntent.advertiserName : nextFilters.query!.trim();
        setHistory(current => {
          const updated = recentTerms([queryToSave, ...current]);
          try { localStorage.setItem(historyStorageKey(searchAccount), JSON.stringify(updated)); } catch { }
          return updated;
        });
      }
    } catch (err: unknown) {
      if (requestController.current !== controller) return;
      if (err instanceof DOMException && err.name === "AbortError" && !timedOut) return;
      if (timedOut) {
        setError({ message: "Search took too long. Please retry.", code: "SEARCH_TIMEOUT" });
        if (!append) {
          setAds([]);
          setCursor(null);
        }
        return;
      }
      const errorObj = typeof err === "object" && err !== null && "message" in err ? (err as { message: string; code?: string }) : { message: "Search is temporarily unavailable." };
      setError(errorObj);
      if (!append) {
        setAds([]);
        setCursor(null);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestController.current === controller) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [setFilters]);

  const searchBrandsController = useRef<AbortController | null>(null);

  const searchBrands = useCallback(async (query?: string) => {
    searchBrandsController.current?.abort();
    const controller = new AbortController();
    searchBrandsController.current = controller;

    setBrandsLoading(true);
    setBrandsError(null);
    try {
      const response = await apiFetch("/api/brands/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw { message: data.error || "Failed to search brands" };
      if (searchBrandsController.current !== controller) return;
      setBrands(data.brands || []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorObj = typeof err === "object" && err !== null && "message" in err ? (err as { message: string }) : { message: "Failed to search brands" };
      setBrandsError(errorObj);
      setBrands([]);
    } finally {
      if (searchBrandsController.current === controller) {
        setBrandsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (filters.view === "brands") {
      searchBrands(filters.query);
    } else {
      search({ ...filters, cursor: undefined });
    }
  }, [filters, search, searchBrands]);

  useEffect(() => {
    setDraftQuery(filters.query || "");
  }, [filters.query]);

  const displayedAds = useMemo(() => sortAds(ads, sort), [ads, sort]);

  useEffect(() => {
    if (!deepLinkedAdId || details) return;
    const local = ads.find((ad) => (ad.externalId || ad.id) === deepLinkedAdId);
    if (local) {
      setDetails(local);
      return;
    }
    let active = true;
    apiFetch(`/api/ads/${encodeURIComponent(deepLinkedAdId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error);
        if (active && data.ad) setDetails(data.ad);
      })
      .catch(() => setToast({ message: "Couldn't open that shared ad.", tone: "error" }));
    return () => {
      active = false;
    };
  }, [ads, deepLinkedAdId, details]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    const normalized = normalizeDiscoverFilters(filters);

    normalized.formats?.forEach(f => {
      chips.push({ key: "formats", label: `Format: ${title(f)}`, value: f });
    });
    normalized.statuses?.forEach(s => {
      chips.push({ key: "statuses", label: `Status: ${title(s)}`, value: s });
    });
    normalized.markets?.forEach(m => {
      const countryName = countries.find(([code]) => code === m)?.[1] || m;
      chips.push({ key: "markets", label: `Market: ${countryName}`, value: m });
    });
    normalized.languages?.forEach(l => {
      chips.push({ key: "languages", label: `Language: ${l.toUpperCase()}`, value: l });
    });
    normalized.niches?.forEach(n => {
      chips.push({ key: "niches", label: `Niche: ${title(n)}`, value: n });
    });
    normalized.contentStyles?.forEach(cs => {
      chips.push({ key: "contentStyles", label: `Style: ${title(cs)}`, value: cs });
    });
    if (normalized.runtime) {
      chips.push({
        key: "runtime",
        label: `Runtime: ${normalized.runtime.minDays || 0}-${normalized.runtime.maxDays || '+'} days`,
        value: "active"
      });
    }
    if (normalized.videoLength) {
      chips.push({
        key: "videoLength",
        label: `Length: ${normalized.videoLength.minSeconds || 0}-${normalized.videoLength.maxSeconds || '+'}s`,
        value: "active"
      });
    }
    normalized.platforms?.forEach(p => {
      chips.push({ key: "platforms", label: title(p), value: p });
    });

    // Legacy singular mapping fallback for chips if no plurals (for backward compatibility if URL has old params)
    if (!normalized.formats?.length && normalized.mediaType && normalized.mediaType !== "all") {
      chips.push({ key: "mediaType", label: `Media: ${title(normalized.mediaType)}`, value: normalized.mediaType });
    }
    if (!normalized.statuses?.length && normalized.status && normalized.status !== "all") {
      chips.push({ key: "status", label: `Status: ${title(normalized.status)}`, value: normalized.status });
    }
    if (!normalized.markets?.length && normalized.country && normalized.country !== "ALL") {
      const countryName = countries.find(([code]) => code === normalized.country)?.[1] || normalized.country;
      chips.push({ key: "country", label: `Country: ${countryName}`, value: normalized.country });
    }

    return chips;
  }, [filters]);

  function removeChip(key: string, value: string) {
    if (key === "platforms") {
      setFilters({ platforms: (filters.platforms || []).filter(item => item !== value) });
    } else if (key === "formats") {
      setFilters({ formats: (filters.formats || []).filter(item => item !== value) });
    } else if (key === "statuses") {
      setFilters({ statuses: (filters.statuses || []).filter(item => item !== value) });
    } else if (key === "markets") {
      setFilters({ markets: (filters.markets || []).filter(item => item !== value) });
    } else if (key === "languages") {
      setFilters({ languages: (filters.languages || []).filter(item => item !== value) });
    } else if (key === "niches") {
      setFilters({ niches: (filters.niches || []).filter(item => item !== value) });
    } else if (key === "contentStyles") {
      setFilters({ contentStyles: (filters.contentStyles || []).filter(item => item !== value) });
    } else if (key === "runtime") {
      setFilters({ runtime: undefined });
    } else if (key === "videoLength") {
      setFilters({ videoLength: undefined });
    } else {
      setFilters({ [key]: defaults[key as keyof AdSearchFilters] });
    }
  }

  function clearAllFilters() {
    setFilters({ ...defaults, query: filters.query, brand: filters.brand, selectedBrand: filters.selectedBrand, view: filters.view, formats: [], statuses: [], markets: [], languages: [], niches: [], contentStyles: [], runtime: undefined, videoLength: undefined });
  }

  async function saveAd(ad: NormalizedAd) {
    try {
      const response = await apiFetch("/api/swipe-files/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: ad.id, externalAdId: (ad.externalId || ad.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSavedAdIds((current) => new Set([...current, (ad.externalId || ad.id)]));
      if (data.swipeFileId) {
        setAdCollectionIds((current) => ({
          ...current,
          [(ad.externalId || ad.id)]: [...new Set([...(current[(ad.externalId || ad.id)] ?? []), data.swipeFileId])],
        }));
      }
      setToast({ message: "Saved to Saved Ads" });
    } catch (error) {
      setToast({ message: "Couldn't save ad. Try again.", tone: "error" });
      throw error;
    }
  }

  async function shareAd(ad: NormalizedAd) {
    setShareAdId(ad.id);
  }

  function handleSwipeFileAdded(ad: NormalizedAd, result: SwipeFileResult) {
    setSavedAdIds((current) => {
      const updated = new Set(current);
      if (result.collectionIds.length) updated.add(ad.externalId || ad.id);
      else updated.delete(ad.externalId || ad.id);
      return updated;
    });
    setAdCollectionIds((current) => ({
      ...current,
      [(ad.externalId || ad.id)]: [...new Set([...(current[(ad.externalId || ad.id)] ?? []), ...result.collectionIds])],
    }));
    setToast({
      message: result.added
        ? result.collectionNames.length > 1 ? `Added to ${result.collectionNames.length} Swipe Files` : `Added to ${result.collectionNames[0] || "Swipe File"}`
        : `Removed from ${result.collectionNames[0] || "Swipe File"}`
    });
  }

  const isBrandsView = filters.view === "brands";
  const hasActiveFilters = activeChips.length > 0;

  return (
    <>
      {!hideHeader && (
        <div className="mb-5 mt-1 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[28px] md:text-[32px]">
            Discover {isBrandsView ? "Brands" : "Ads"}
          </h1>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </div>
      )}

      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-30 mb-8 border-b border-zinc-200/70 bg-white/90 pb-4 pt-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4">
          {!hideHeader && (
            <div className="relative flex items-center rounded-[26px] border border-zinc-200/80 bg-white p-1.5 shadow-[0_12px_35px_rgba(15,23,42,0.10)] transition focus-within:border-emerald-300 focus-within:shadow-[0_12px_35px_rgba(15,23,42,0.10),0_0_0_3px_rgba(5,150,105,0.10)]">
              <SearchAutocomplete
                key={accountId || "signed-out"}
                accountKey={accountId}
                history={historyOwner === accountId ? history : []}
                onHistoryChange={(next) => {
                  setHistory(next);
                  try { if (accountId) localStorage.setItem(historyStorageKey(accountId), JSON.stringify(next)); } catch { }
                }}
                placeholder={isBrandsView ? "Search brands..." : "Search competitor ads, brands, products or keywords..."}
                value={draftQuery}
                onChange={setDraftQuery}
                onSubmit={(val) => {
                  setFilters({ query: val, brand: undefined, selectedBrand: undefined }, false);
                }}
                onSelectBrand={(suggestion) => {
                  setFilters({ query: suggestion.label, brand: suggestion.id, selectedBrand: suggestion.brand });
                }}
                onSelectCategory={(id, type) => {
                  const key = type === "Niche" ? "niches" : type === "Style" ? "contentStyles" : type === "Language" ? "languages" : "markets";
                  const currentArray = (filters[key as keyof AdSearchFilters] as string[]) || [];
                  setFilters({
                    query: "",
                    brand: undefined,
                    [key]: [...new Set([...currentArray, id.replace(/^cat_[^_]+_/, '')])]
                  });
                }}
                onClear={() => {
                  setDraftQuery("");
                }}
                embedded
                className="min-w-0 flex-1"
              />
              <div className="hidden shrink-0 items-center gap-1.5 border-l border-zinc-200 pl-2 pr-1 lg:flex">
                <div className="flex items-center rounded-full bg-zinc-50 p-1">
                  <button
                    type="button"
                    onClick={() => setFilters({ view: "ads" })}
                    className={cn("h-9 rounded-full px-4 text-[13px] font-semibold transition", !isBrandsView ? "bg-emerald-700 text-white shadow-sm" : "text-zinc-600 hover:bg-white")}
                  >
                    All Ads
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters({ view: "brands" })}
                    className={cn("h-9 rounded-full px-4 text-[13px] font-semibold transition", isBrandsView ? "bg-emerald-700 text-white shadow-sm" : "text-zinc-600 hover:bg-white")}
                  >
                    Brands
                  </button>
                </div>
                <SavedFiltersPopover filters={filters} updateFilters={setFilters} />
                <AdvancedFilters filters={filters} updateFilters={setFilters} clearFilters={clearAllFilters} />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              {!hideHeader && (
                <div className="flex items-center rounded-full bg-emerald-50 p-1 lg:hidden">
                  <button type="button" onClick={() => setFilters({ view: "ads" })} className={cn("h-9 rounded-full px-4 text-[13px] font-semibold", !isBrandsView ? "bg-emerald-700 text-white shadow-sm" : "text-zinc-600")}>All Ads</button>
                  <button type="button" onClick={() => setFilters({ view: "brands" })} className={cn("h-9 rounded-full px-4 text-[13px] font-semibold", isBrandsView ? "bg-emerald-700 text-white shadow-sm" : "text-zinc-600")}>Brands</button>
                </div>
              )}
              <div className="flex items-center rounded-full border border-zinc-200 bg-white p-1 shadow-sm" role="group" aria-label="Display layout">
                <button type="button" onClick={() => setLayout("grid")} aria-label="Grid view" aria-pressed={layout === "grid"} className={cn("flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition", layout === "grid" ? "bg-emerald-100 text-emerald-800" : "text-zinc-400 hover:text-zinc-700")}><Grid2X2 size={14} /> Grid</button>
                <button type="button" onClick={() => setLayout("list")} aria-label="List view" aria-pressed={layout === "list"} className={cn("flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition", layout === "list" ? "bg-emerald-100 text-emerald-800" : "text-zinc-400 hover:text-zinc-700")}><List size={14} /> List</button>
              </div>
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 lg:hidden">
                <SavedFiltersPopover filters={filters} updateFilters={setFilters} />
                <AdvancedFilters filters={filters} updateFilters={setFilters} clearFilters={clearAllFilters} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CompactSelect ariaLabel="Sort" value={sort} onChange={setSort} options={[["relevant", "Most relevant"], ["newest", "Most recent"], ["oldest", "Oldest"], ["longest", "Longest running"], ["variations", "Most variations"]]} />
            </div>
          </div>
        </div>



        {filters.query && <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span>{filters.brand ? "Applied brand" : "Current search"}: {filters.query}</span>
          <button type="button" className="min-h-11 px-2 underline" onClick={() => { setDraftQuery(""); setFilters({ query: "", brand: undefined, selectedBrand: undefined }); }}>Clear search</button>
        </div>}

        {activeChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 pb-1">
            {activeChips.map(chip => (
              <button key={`${chip.key}-${chip.value}`} onClick={() => removeChip(chip.key, chip.value)} className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[13px] font-medium text-ink hover:bg-zinc-50 transition shadow-sm">
                {chip.label}
                <X size={14} className="text-muted hover:text-ink" />
              </button>
            ))}
            <button onClick={clearAllFilters} className="text-[13px] font-medium text-muted hover:text-ink ml-2">
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="mt-3">
        {isBrandsView ? (
          brandsLoading && brands.length === 0 ? (
            <BrandGridSkeleton />
          ) : brandsError ? (
            <EmptyState title="Search Error" body={brandsError.message} />
          ) : brands.length === 0 && !brandsLoading ? (
            <EmptyState title="No brands found" body="Try searching for another brand name." />
          ) : (
            <div className={cn(layout === "grid" ? brandGridClass() : "grid grid-cols-1 gap-3", brandsLoading && "opacity-60 transition-opacity")}>
              {brands.map(brand => <BrandCard key={brand.id} brand={brand} layout={layout} />)}
            </div>
          )
        ) : (
          loading && ads.length === 0 ? (
            <AdGridSkeleton />
          ) : error ? (
            <EmptyState
              icon={<Filter className="text-signal" />}
              title={error.code === "PROVIDER_NOT_CONFIGURED" ? "No Ads Provider Configured" : error.code === "PROVIDER_UNAVAILABLE" ? "All Ad Providers Unavailable" : "Search Temporarily Unavailable"}
              body={error.message}
              action={
                <Button
                  variant="secondary"
                  onClick={() => search({ ...filters, sessionId: searchSessionIdRef.current || undefined })}
                >
                  <RefreshCw size={15} /> Retry search
                </Button>
              }
            />
          ) : ads.length === 0 && !loading ? (
            <EmptyState
              icon={<Search />}
              title={
                !hasActiveFilters && !filters.query && !filters.brand
                  ? "Welcome to Ad Discovery"
                  : filters.brand
                    ? "No advertiser ads found"
                    : "No ads found"
              }
              body={
                !hasActiveFilters && !filters.query && !filters.brand
                  ? "Search for keywords, brands, or products above to Discover our ads."
                  : filters.brand
                    ? `No ${filters.query || "advertiser"} ads match these filters. Try adjusting your filters.`
                    : filters.query?.trim()
                      ? `No ads found for "${filters.query.trim()}". Try another keyword or remove active filters.`
                      : "Try removing active filters or typing a keyword above to search live ads."
              }
              action={
                hasActiveFilters || filters.query || filters.brand ? (
                  <Button variant="secondary" onClick={() => clearFilters(false)}>
                    Clear all filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={cn(layout === "grid" ? gridClass() : "grid grid-cols-1 gap-3", loading && !loadingMore && "opacity-60 transition-opacity")}>
              {displayedAds.map(ad => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  saved={savedAdIds.has((ad.externalId || ad.id))}
                  swipeFileCount={adCollectionIds[(ad.externalId || ad.id)]?.length ?? 0}
                  initialCollectionIds={adCollectionIds[(ad.externalId || ad.id)] ?? []}
                  onOpen={() => setDetails(ad)}
                  onSave={() => saveAd(ad)}
                  onSwipeFileAdded={(result) => handleSwipeFileAdded(ad, result)}
                  onShare={() => shareAd(ad)}
                  layout={layout}
                />
              ))}
            </div>
          )
        )}
      </div>

      {!isBrandsView && cursor && !loading && ads.length > 0 && (
        <div className="mt-7 flex justify-center">
          <Button variant="secondary" disabled={loadingMore} onClick={() => search({ ...filters, cursor, sessionId: searchSessionIdRef.current || undefined }, true)}>
            {loadingMore && <Loader2 className="animate-spin" size={16} />}
            Load more ads
          </Button>
        </div>
      )}

      {details && (
        <AdDetailDrawer
          ad={details}
          saved={savedAdIds.has(details.externalId ?? details.id)}
          onClose={() => setDetails(null)}
          onSave={() => saveAd(details)}
          onPrevious={() => {
            const index = displayedAds.findIndex((ad) => ad.id === details.id);
            if (index > 0) setDetails(displayedAds[index - 1]);
          }}
          onNext={() => {
            const index = displayedAds.findIndex((ad) => ad.id === details.id);
            if (index >= 0 && index < displayedAds.length - 1) setDetails(displayedAds[index + 1]);
          }}
          hasPrevious={displayedAds.findIndex((ad) => ad.id === details.id) > 0}
          hasNext={displayedAds.findIndex((ad) => ad.id === details.id) < displayedAds.length - 1}
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
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </>
  );

}

function CompactSelect({ ariaLabel, value, options, onChange }: { ariaLabel: string; value?: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <span className="relative inline-block h-9">
      <select
        aria-label={ariaLabel}
        value={value || ""}
        onChange={event => onChange(event.target.value)}
        className="h-full appearance-none rounded-full border border-zinc-200 bg-white px-4 pr-9 text-[13px] font-semibold text-zinc-700 shadow-sm outline-none transition hover:bg-zinc-50 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
    </span>
  );
}

function AdGridSkeleton() {
  return (
    <div className={gridClass()}>
      {Array.from({ length: 18 }).map((_, index) => (
        <div key={index} className="flex flex-col w-full overflow-hidden rounded-[12px] border border-line bg-white shadow-sm">
          <div className="flex min-h-[52px] items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="aspect-[4/5] w-full rounded-none" />
          <div className="border-t border-line px-3 py-2 flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function gridClass() {
  return "grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-5";
}

function brandGridClass() {
  return "grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5";
}

function BrandGridSkeleton() {
  return (
    <div className={brandGridClass()}>
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="flex flex-col w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white p-[16px]">
          <div className="flex items-center gap-[12px] mb-[14px]">
            <Skeleton className="size-[38px] rounded-[10px] shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="flex items-center gap-[16px] mb-[16px]">
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
          <div className="flex gap-[6px] mb-[16px]">
            <Skeleton className="flex-1 aspect-[4/5] rounded-lg" />
            <Skeleton className="flex-1 aspect-[4/5] rounded-lg" />
            <Skeleton className="flex-1 aspect-[4/5] rounded-lg" />
          </div>
          <div className="mt-auto pt-[4px] flex justify-between">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
        </div>
      ))}
    </div>
  );
}


function title(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function sortAds(ads: NormalizedAd[], sort?: string) {
  if (sort === "newest") return [...ads].sort((a, b) => new Date(b.delivery.startedAt || 0).getTime() - new Date(a.delivery.startedAt || 0).getTime());
  if (sort === "oldest") return [...ads].sort((a, b) => new Date(a.delivery.startedAt || 0).getTime() - new Date(b.delivery.startedAt || 0).getTime());
  if (sort === "longest") return [...ads].sort((a, b) => (b.delivery.daysRunning || 0) - (a.delivery.daysRunning || 0));
  if (sort === "variations") return [...ads].sort((a, b) => (b.variants || 1) - (a.variants || 1));
  return ads;
}

function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 px-4 sm:left-auto sm:right-5 sm:translate-x-0 sm:px-0" role="status" aria-live="polite">
      <div className={`rounded-lg border px-4 py-3 text-sm font-semibold shadow-card ${tone === "error" ? "border-red-100 bg-red-50 text-signal" : "border-line bg-white text-ink"}`}>
        {message}
      </div>
    </div>
  );
}
