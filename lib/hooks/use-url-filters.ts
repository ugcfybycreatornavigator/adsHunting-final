import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdSearchFilters } from "@/lib/types";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";

// Helper to safely parse JSON from URL
function safeParseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function useUrlFilters(defaultFilters: AdSearchFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial filters from URL
  const initialFilters = useMemo(() => {
    const parsed: Partial<AdSearchFilters> = {};
    searchParams.forEach((value, key) => {
      if (key === "q" || key === "query") parsed.query = value;
      else if (key === "view") parsed.view = value as "ads" | "brands";
      else if (key === "brand") parsed.brand = value;
      else if (key === "sort") parsed.sort = value;
      else if (key === "platforms") parsed.platforms = value.split(",");
      else if (key === "formats") parsed.formats = value.split(",") as AdSearchFilters["formats"];
      else if (key === "statuses") parsed.statuses = value.split(",") as AdSearchFilters["statuses"];
      else if (key === "markets") parsed.markets = value.split(",");
      else if (key === "languages") parsed.languages = value.split(",");
      else if (key === "niches") parsed.niches = value.split(",");
      else if (key === "contentStyles") parsed.contentStyles = value.split(",");
      else if (key === "runtime") parsed.runtime = safeParseJSON(value, undefined);
      else if (key === "videoLength") parsed.videoLength = safeParseJSON(value, undefined);
      else if (key === "startDate") parsed.startDate = value;
      else if (key === "endDate") parsed.endDate = value;
      else if (key === "cta") parsed.cta = value;
      // Legacy
      else if (key === "status") parsed.status = value as AdSearchFilters["status"];
      else if (key === "country") parsed.country = value;
      else if (key === "mediaType") parsed.mediaType = value as AdSearchFilters["mediaType"];
      else if (key === "language") parsed.language = value;
      else if (key === "duration") parsed.duration = value;
    });

    return { ...defaultFilters, ...parsed };
  }, [searchParams, defaultFilters]);

  const [filters, setFilters] = useState<AdSearchFilters>(initialFilters);

  // Sync back to URL when filters change (using replaceState for speed)
  const syncToUrl = useCallback((newFilters: AdSearchFilters, replace = true) => {
    const params = new URLSearchParams();
    const normalized = normalizeDiscoverFilters(newFilters);
    
    // We only put non-default/non-empty values in the URL
    if (newFilters.view && newFilters.view !== "ads") params.set("view", newFilters.view);
    if (normalized.query) params.set("q", normalized.query);
    if (normalized.brand) params.set("brand", normalized.brand);
    if (normalized.sort && normalized.sort !== defaultFilters.sort) params.set("sort", normalized.sort);
    if (normalized.platforms?.length) params.set("platforms", normalized.platforms.join(","));
    if (normalized.formats?.length) params.set("formats", normalized.formats.join(","));
    if (normalized.statuses?.length) params.set("statuses", normalized.statuses.join(","));
    if (normalized.markets?.length) params.set("markets", normalized.markets.join(","));
    if (normalized.languages?.length) params.set("languages", normalized.languages.join(","));
    if (normalized.niches?.length) params.set("niches", normalized.niches.join(","));
    if (normalized.contentStyles?.length) params.set("contentStyles", normalized.contentStyles.join(","));
    if (normalized.runtime) params.set("runtime", JSON.stringify(normalized.runtime));
    if (normalized.videoLength) params.set("videoLength", JSON.stringify(normalized.videoLength));
    if (normalized.startDate) params.set("startDate", normalized.startDate);
    if (normalized.endDate) params.set("endDate", normalized.endDate);
    if (normalized.cta) params.set("cta", normalized.cta);
    
    // Legacy singular values (if used directly, though we prefer plural now)
    if (normalized.status && normalized.status !== "all" && !normalized.statuses?.length) params.set("status", normalized.status);
    if (normalized.country && normalized.country !== "ALL" && !normalized.markets?.length) params.set("country", normalized.country);
    if (normalized.mediaType && normalized.mediaType !== "all" && !normalized.formats?.length) params.set("mediaType", normalized.mediaType);
    if (normalized.language && !normalized.languages?.length) params.set("language", normalized.language);
    if (normalized.duration && !normalized.runtime) params.set("duration", normalized.duration);

    const queryStr = params.toString();
    const newUrl = queryStr ? `${pathname}?${queryStr}` : pathname;

    const currentSearch = window.location.search;
    const currentUrl = pathname + (currentSearch ? currentSearch : "");
    if (newUrl === currentUrl) return; // Prevent unnecessary history state updates

    if (replace) {
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
    } else {
      router.push(newUrl);
    }
  }, [pathname, router, defaultFilters]);

  // Handle popstate so browser back/forward works
  useEffect(() => {
    const handlePopState = () => {
      // When back button is pressed, the URL changes but React state needs to sync
      const params = new URLSearchParams(window.location.search);
      const parsed: Partial<AdSearchFilters> = {};
      
      params.forEach((value, key) => {
        if (key === "q" || key === "query") parsed.query = value;
        else if (key === "view") parsed.view = value as "ads" | "brands";
        else if (key === "brand") parsed.brand = value;
        else if (key === "sort") parsed.sort = value;
        else if (key === "platforms") parsed.platforms = value.split(",");
        else if (key === "formats") parsed.formats = value.split(",") as AdSearchFilters["formats"];
        else if (key === "statuses") parsed.statuses = value.split(",") as AdSearchFilters["statuses"];
        else if (key === "markets") parsed.markets = value.split(",");
        else if (key === "languages") parsed.languages = value.split(",");
        else if (key === "niches") parsed.niches = value.split(",");
        else if (key === "contentStyles") parsed.contentStyles = value.split(",");
        else if (key === "runtime") parsed.runtime = safeParseJSON(value, undefined);
        else if (key === "videoLength") parsed.videoLength = safeParseJSON(value, undefined);
        else if (key === "startDate") parsed.startDate = value;
        else if (key === "endDate") parsed.endDate = value;
        else if (key === "cta") parsed.cta = value;
      });

      setFilters({ ...defaultFilters, ...parsed });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [defaultFilters]);

  const updateFilters = useCallback((updates: Partial<AdSearchFilters>, replace = true) => {
    setFilters(prev => {
      const next = { ...prev, ...updates };
      // Always reset cursor/pagination when filters change
      next.cursor = undefined;
      syncToUrl(next, replace);
      return next;
    });
  }, [syncToUrl]);

  const clearFilters = useCallback((replace = true) => {
    setFilters({ ...defaultFilters });
    syncToUrl({ ...defaultFilters }, replace);
  }, [defaultFilters, syncToUrl]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
