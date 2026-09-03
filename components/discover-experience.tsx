"use client";
import { apiFetch } from "@/lib/api-client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, History, Loader2, RefreshCw, Search, X } from "lucide-react";
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
import { useAdImpressionTracker } from "@/lib/hooks/use-ad-impression-tracker";
import { useCredits } from "@/components/billing/CreditsContext";
import { useRouter } from "next/navigation";
import type { AdSearchFilters, AdSearchResult, NormalizedAd } from "@/lib/types";
import type { BrandSummary } from "@/lib/brand-data";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";

const countries = [["ALL","All countries"],["IN","India"],["US","United States"],["GB","United Kingdom"],["CA","Canada"],["AU","Australia"],["DE","Germany"],["FR","France"],["BR","Brazil"]];
const defaults: AdSearchFilters = { query: "", status: "all", country: "ALL", platforms: [], mediaType: "all", cta: "", duration: "", startDate: "", endDate: "" };

export function DiscoverExperience({ brandId, source, hideHeader = false }: { brandId?: string, source?: "competitor", hideHeader?: boolean }) {
  const { reportUsage, state: creditState } = useCredits();
  const defaultFilters = useMemo(() => ({ ...defaults, brand: brandId, source }), [brandId, source]);
  const { filters, updateFilters: setFilters, clearFilters } = useUrlFilters(defaultFilters);
  const [ads, setAds] = useState<NormalizedAd[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
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
  const [history, setHistory] = useState<string[]>([]);
  const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
  const [adCollectionIds, setAdCollectionIds] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" } | null>(null);
  const [deepLinkedAdId, setDeepLinkedAdId] = useState<string | null>(null);
  const [searchSessionId, setSearchSessionId] = useState<string | null>(null);
  const first = useRef(true);
  const requestController = useRef<AbortController | null>(null);
  const router = useRouter();

  const observerRef = useAdImpressionTracker(searchSessionId, filters.view !== "brands" && !loading);
  const adRef = useCallback((node: HTMLDivElement | null) => {
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, [observerRef]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("signal-search-history") || "[]")); } catch {}
    if (typeof window !== "undefined") {
      setDeepLinkedAdId(new URLSearchParams(window.location.search).get("ad"));
    }
  }, []);

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
    if (!append) requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/ads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextFilters),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw { message: data.message || data.error || "Search failed.", code: data.code };
      }
      const result = data as AdSearchResult;
      
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
      setTotal(result.total);
      
      if (!append && result.requestId) {
        setSearchSessionId(result.requestId);
      }

      if (nextFilters.query?.trim() || result.resolvedIntent?.type === "advertiser") {
        const queryToSave = result.resolvedIntent?.type === "advertiser" ? result.resolvedIntent.advertiserName : nextFilters.query!.trim();
        setHistory(current => {
          const updated = [queryToSave, ...current.filter(item => item.toLowerCase() !== queryToSave.toLowerCase())].slice(0, 6);
          localStorage.setItem("signal-search-history", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorObj = typeof err === "object" && err !== null && "message" in err ? (err as { message: string; code?: string }) : { message: "Search is temporarily unavailable." };
      setError(errorObj);
      if (!append) {
        setAds([]);
        setCursor(null);
        setTotal(null);
      }
    } finally {
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
    const timer = setTimeout(() => {
      if (filters.view === "brands") {
        searchBrands(filters.query);
      } else {
        search({ ...filters, cursor: undefined });
      }
    }, first.current ? 0 : 400);
    first.current = false;
    return () => clearTimeout(timer);
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
      setFilters({ platforms: (filters.platforms || []).filter((item: string) => item !== value) });
    } else if (key === "formats") {
      setFilters({ formats: (filters.formats || []).filter((item: string) => item !== value) });
    } else if (key === "statuses") {
      setFilters({ statuses: (filters.statuses || []).filter((item: string) => item !== value) });
    } else if (key === "markets") {
      setFilters({ markets: (filters.markets || []).filter((item: string) => item !== value) });
    } else if (key === "languages") {
      setFilters({ languages: (filters.languages || []).filter((item: string) => item !== value) });
    } else if (key === "niches") {
      setFilters({ niches: (filters.niches || []).filter((item: string) => item !== value) });
    } else if (key === "contentStyles") {
      setFilters({ contentStyles: (filters.contentStyles || []).filter((item: string) => item !== value) });
    } else if (key === "runtime") {
      setFilters({ runtime: undefined });
    } else if (key === "videoLength") {
      setFilters({ videoLength: undefined });
    } else {
      setFilters({ [key]: defaults[key as keyof AdSearchFilters] });
    }
  }

  function clearAllFilters() {
    clearFilters();
  }

  function update<K extends keyof AdSearchFilters>(key: K, value: AdSearchFilters[K]) {
    setFilters({ [key]: value });
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
    setSavedAdIds((current) => new Set([...current, (ad.externalId || ad.id)]));
    setAdCollectionIds((current) => ({
      ...current,
      [(ad.externalId || ad.id)]: [...new Set([...(current[(ad.externalId || ad.id)] ?? []), ...result.collectionIds])],
    }));
    setToast({ message: result.collectionNames.length > 1 ? `Added to ${result.collectionNames.length} Swipe Files` : `Added to ${result.collectionNames[0] || "Swipe File"}` });
  }

  const isBrandsView = filters.view === "brands";

  return (
    <>
      {!hideHeader && (
        <div className="mb-6 mt-1 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-[32px] font-extrabold tracking-tight text-zinc-900 flex items-center gap-3">
              Discover {isBrandsView ? "Brands" : "Ads"}
              <span className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[13px] font-semibold text-zinc-600 tabular-nums shadow-sm border border-zinc-200/50">
                {loading || brandsLoading ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Searching</span>
                ) : isBrandsView ? (
                  `${brands.length} brand${brands.length === 1 ? "" : "s"}`
                ) : total != null ? (
                  `${total.toLocaleString()} ads`
                ) : (
                  `${ads.length.toLocaleString()} ads`
                )}
              </span>
            </h1>
            <p className="mt-2 text-[15px] text-zinc-500">
              {isBrandsView ? "Discover top brands and advertisers." : "Research competitor creatives and winning ad patterns."}
            </p>
          </div>
        </div>
      )}

      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-30 mb-8 bg-white/85 pb-4 pt-4 backdrop-blur-xl border-b border-zinc-200/80">
        <div className="flex flex-col gap-4">
          {!hideHeader && (
            <div className="relative">
              <SearchAutocomplete 
                placeholder={isBrandsView ? "Search brands..." : "Search competitor ads, brands, products or keywords..."}
                value={draftQuery}
                onChange={setDraftQuery}
                onSubmit={(val) => {
                  setFilters({ query: val, brand: undefined });
                }}
                onSelectBrand={(id, name) => {
                  setFilters({ query: name, brand: id });
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
                  setFilters({ query: "", brand: undefined });
                }}
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <AdvancedFilters filters={filters} updateFilters={setFilters} clearFilters={clearAllFilters} />
              <SavedFiltersPopover filters={filters} updateFilters={setFilters} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CompactSelect ariaLabel="Sort" value={sort} onChange={setSort} options={[["relevant","Relevant"],["newest","Newest"],["oldest","Oldest"],["longest","Longest Running"],["variations","Variations"]]} />
              
              {!hideHeader && (
                <div className="flex items-center rounded-[10px] bg-zinc-100/80 p-[3px] shrink-0 h-9 border border-zinc-200/60 shadow-inner">
                  <button 
                    type="button" 
                    onClick={() => setFilters({ view: "ads" })} 
                    className={cn("rounded-md px-4 py-1 text-[13px] font-semibold transition-all h-full", !isBrandsView ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-900")}
                  >
                    All Ads
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setFilters({ view: "brands" })} 
                    className={cn("rounded-md px-4 py-1 text-[13px] font-semibold transition-all h-full", isBrandsView ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-900")}
                  >
                    Brands
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>



        {!filters.query && history.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <History size={13} className="shrink-0 text-zinc-400" />
            {history.map(item => (
              <button key={item} onClick={() => update("query", item)} className="shrink-0 rounded-full bg-zinc-50 border border-line px-3 py-1 text-xs font-medium text-muted hover:text-ink">
                {item}
              </button>
            ))}
            <button onClick={() => { localStorage.removeItem("signal-search-history"); setHistory([]); }} className="shrink-0 px-2 text-[11px] text-zinc-400 hover:text-signal">
              Clear
            </button>
          </div>
        )}

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
            <div className={cn(brandGridClass(), brandsLoading && "opacity-60 transition-opacity")}>
              {brands.map(brand => <BrandCard key={brand.id} brand={brand} />)}
            </div>
          )
        ) : (
          loading && ads.length === 0 ? (
            <AdGridSkeleton />
          ) : error ? (
            <EmptyState
              icon={<Filter className="text-signal" />}
              title={error.code === "NOT_CONFIGURED" ? "No Ads Provider Configured" : error.code === "INSUFFICIENT_CREDITS" ? "Out of Credits" : "Search Temporarily Unavailable"}
              body={error.code === "INSUFFICIENT_CREDITS" ? "You have exhausted your credit allowance for this billing cycle. Please wait for your cycle to reset or upgrade your plan." : error.message}
              action={
                error.code === "INSUFFICIENT_CREDITS" ? (
                  <Button variant="secondary" onClick={() => router.push('/settings/billing')}>
                    Upgrade plan
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => search(filters)}>
                    <RefreshCw size={15} /> Retry search
                  </Button>
                )
              }
            />
          ) : ads.length === 0 && !loading ? (
            <EmptyState
              icon={<Search />}
              title={filters.brand ? "No advertiser ads found" : "No ads found"}
              body={filters.brand ? `No ${filters.query || "advertiser"} ads match these filters. Try adjusting your filters.` : filters.query?.trim() ? `No ads found for "${filters.query.trim()}". Try another keyword or remove active filters.` : "Try removing active filters or typing a keyword above to search live ads."}
              action={activeChips.length > 0 ? (
                <Button variant="secondary" onClick={clearAllFilters}>Clear filters</Button>
              ) : undefined}
            />
          ) : (
            <div className={cn(gridClass(), loading && !loadingMore && "opacity-60 transition-opacity")}>
              {displayedAds.map(ad => (
                <div ref={adRef} data-ad-id={ad.externalId || ad.id} key={ad.id} className="relative">
                  <AdCard
                    ad={ad}
                    saved={savedAdIds.has((ad.externalId || ad.id))}
                    swipeFileCount={adCollectionIds[(ad.externalId || ad.id)]?.length ?? 0}
                    initialCollectionIds={adCollectionIds[(ad.externalId || ad.id)] ?? []}
                    onOpen={() => {
                      if (creditState?.isExhausted) {
                        setToast({ 
                          message: `Credit limit reached. You've used ${creditState.creditsAllocated.toLocaleString()} of ${creditState.creditsAllocated.toLocaleString()} credits.`, 
                          tone: "error" 
                        });
                        return;
                      }
                      setDetails(ad);
                      if (searchSessionId) {
                        reportUsage(searchSessionId, "ad_open", [ad.externalId || ad.id]);
                      }
                    }}
                    onSave={() => saveAd(ad)}
                    onSwipeFileAdded={(result) => handleSwipeFileAdded(ad, result)}
                    onShare={() => shareAd(ad)}
                  />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {!isBrandsView && cursor && !loading && ads.length > 0 && (
        <div className="mt-7 flex justify-center">
          <Button variant="secondary" disabled={loadingMore} onClick={() => search({ ...filters, cursor }, true)}>
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
        className="h-full appearance-none rounded-[8px] border border-line bg-white px-3 pr-8 text-[13px] font-semibold text-ink outline-none transition hover:bg-zinc-50 focus:border-[#68B32F] focus:ring-[2px] focus:ring-[#68B32F]/15 shadow-sm"
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
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5";
}

function brandGridClass() {
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5";
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
