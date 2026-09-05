import { matchingBrand, realAdvertiserName, resolveAdvertiser } from "../../supabase/functions/_shared/ads/advertiser-identity";
import type { AdProvider, AdSearchFilters, AdSearchResult, NormalizedAd, ProviderCapabilities } from "@/lib/types";
import { daysBetween, sanitizeAdCopy, extractAdvertiserName } from "@/lib/utils";
import { ProviderError, providerErrorFromStatus } from "@/lib/providers/errors";
import { computeAdIntelligence } from "@/lib/intelligence";

import { refineAd } from "@/lib/refinement";
type MetaRawAd = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
};

type MetaResponse = {
  data?: MetaRawAd[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string };
};

const fields = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "publisher_platforms",
  "languages",
].join(",");

export class MetaProvider implements AdProvider {
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true, advertiserSearch: true, commercialAds: true,
    pagination: true, demographics: false, copy: true, landingPage: false,
    formats: "POST_FILTER",
    statuses: "NATIVE",
    markets: "NATIVE",
    languages: "POST_FILTER",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };
  constructor(private config: { accessToken: string; apiVersion: string; defaultCountry?: string }) {
    if (!/^v\d+\.\d+$/.test(config.apiVersion)) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "META_API_VERSION must look like v25.0.", 503);
    }
  }

  async healthCheck(): Promise<void> {
    const params = new URLSearchParams({
      access_token: this.config.accessToken,
      ad_reached_countries: JSON.stringify([this.config.defaultCountry || "US"]),
      search_terms: "a",
      ad_active_status: "ALL",
      limit: "1",
    });
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${this.config.apiVersion}/ads_archive?${params}`, {
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
    } catch (error) {
      throw new ProviderError(
        error instanceof DOMException && error.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        "Meta API connection failed before a response was received.",
        502
      );
    }

    const payload = (await response.json().catch(() => ({}))) as MetaResponse;
    if (!response.ok || payload.error) {
      const detail = payload.error?.error_user_msg || payload.error?.message;
      const code = payload.error?.code;
      if (code === 10 || payload.error?.error_subcode === 2332002) {
        throw new ProviderError("META_PERMISSION_ERROR", "Meta ads_archive permission is not available for this token or query.", 403);
      }
      if (code === 190 || detail?.toLowerCase().includes("expired") || detail?.toLowerCase().includes("session")) {
        throw new ProviderError("META_TOKEN_EXPIRED", "Meta access token has expired.", 401);
      }
      throw providerErrorFromStatus("Meta API", response.status || 502, detail);
    }
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    let markets = filters.markets && filters.markets.length > 0 
      ? filters.markets 
      : filters.country && filters.country !== "ALL" 
        ? [filters.country] 
        : [this.config.defaultCountry || "ALL"];
    
    markets = markets.map(c => c.toUpperCase());
    
    const params = new URLSearchParams({
      access_token: this.config.accessToken,
      ad_reached_countries: JSON.stringify(markets),
      ad_type: "ALL",
      fields,
      limit: "25",
    });

    if (filters.brand) {
      if (filters.selectedBrand && filters.selectedBrand.provider !== "meta") {
        throw new ProviderError("PROVIDER_UNSUPPORTED", "No verified Meta page ID for this advertiser.", 422);
      }
      params.set("search_page_ids", JSON.stringify([filters.selectedBrand?.providerAdvertiserId || filters.brand]));
    } else if (filters.query?.trim()) {
      params.set("search_terms", filters.query.trim());
    } else {
      throw new ProviderError("MISSING_QUERY", "A search keyword or brand is required for Meta Ad Library.", 400);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      if (filters.statuses.includes("active") && !filters.statuses.includes("inactive")) {
        params.set("ad_active_status", "ACTIVE");
      } else if (filters.statuses.includes("inactive") && !filters.statuses.includes("active")) {
        params.set("ad_active_status", "INACTIVE");
      } else {
        params.set("ad_active_status", "ALL");
      }
    } else if (filters.status && filters.status !== "all") {
      params.set("ad_active_status", filters.status.toUpperCase());
    }
    if (filters.mediaType && !["all", "carousel", "unknown"].includes(filters.mediaType)) {
      params.set("media_type", filters.mediaType.toUpperCase());
    }
    if (filters.platforms?.length) {
      params.set(
        "publisher_platforms",
        JSON.stringify(filters.platforms.map((value) => value.toUpperCase()))
      );
    }
    if (filters.startDate) params.set("ad_delivery_date_min", filters.startDate);
    if (filters.endDate) params.set("ad_delivery_date_max", filters.endDate);
    if (filters.cursor) params.set("after", filters.cursor);

    const url = `https://graph.facebook.com/${this.config.apiVersion}/ads_archive?${params}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    } catch (error) {
      throw new ProviderError(
        error instanceof DOMException && error.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        "Meta API request failed before a response was received.",
        502
      );
    }

    const payload = (await response.json().catch(() => ({}))) as MetaResponse;
    if (!response.ok || payload.error) {
      const detail = payload.error?.error_user_msg || payload.error?.message;
      const code = payload.error?.code;
      if (code === 10 || payload.error?.error_subcode === 2332002) {
        throw new ProviderError("META_PERMISSION_ERROR", "Meta ads_archive permission is not available for this token or query.", 403);
      }
      if (code === 190 || detail?.toLowerCase().includes("expired") || detail?.toLowerCase().includes("session")) {
        throw new ProviderError("META_TOKEN_EXPIRED", "Meta access token has expired.", 401);
      }
      throw providerErrorFromStatus("Meta API", response.status || 502, detail);
    }

    const pageId = filters.selectedBrand?.providerAdvertiserId || filters.brand;
    const ads = (payload.data ?? [])
      .filter(raw => !filters.brand || raw.page_id === pageId)
      .map(raw => {
        const ad = normalizeMetaAd(raw, markets[0] || "ALL");
        ad.advertiser = resolveAdvertiser(ad.advertiser, undefined,
          matchingBrand(filters.selectedBrand, "meta", filters.brand, raw.page_id));
        return ad;
      });
    return { ads, nextCursor: payload.paging?.cursors?.after ?? null, total: null, source: "provider" };
  }
}

function normalizeMetaAd(raw: MetaRawAd, country: string): NormalizedAd {
  const startDate = raw.ad_delivery_start_time || raw.ad_creation_time || null;
  const stopDate = raw.ad_delivery_stop_time || null;
  const status = stopDate ? ("inactive" as const) : ("active" as const);
  const runningDays = daysBetween(startDate, stopDate);
  const variants = 1;
  const repetition = 0;
  const safeSnapshot = `https://www.facebook.com/ads/library/?id=${encodeURIComponent(raw.id)}`;
  const sanitizedRaw: Record<string, unknown> = { ...raw, ad_snapshot_url: safeSnapshot };
  const platformsList = (raw.publisher_platforms ?? []).map((value) => value.toLowerCase());
  const bodyText = sanitizeAdCopy(raw.ad_creative_bodies?.[0] || null);
  const headlineText = sanitizeAdCopy(raw.ad_creative_link_titles?.[0] || null);

  const intel = computeAdIntelligence({
    startDate,
    stopDate,
    status,
    lastSeenAt: new Date().toISOString(),
    variants,
    creativeRepetition: repetition,
    platforms: platformsList,
    mediaType: "unknown",
    headline: headlineText,
    body: bodyText,
    advertiserId: raw.page_id,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAny = raw as any;

  const baseAd: Partial<NormalizedAd> = {
    id: raw.id,
    externalId: raw.id,
    provider: {
      discoveryProvider: "meta_official",
      fetchedAt: new Date().toISOString(),
    },
    advertiser: {
      id: raw.page_id || null,
      name: realAdvertiserName(raw.page_name, raw.page_id),
      normalizedName: null,
      pageUrl: null,
      logoUrl: null,
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: bodyText,
      headline: headlineText,
      description: sanitizeAdCopy(raw.ad_creative_link_descriptions?.[0] || raw.ad_creative_link_captions?.[0] || null),
      cta: null,
    },
    creative: {
      type: "unknown",
      imageUrl: rawAny.image_url || rawAny.original_image_url || rawAny.resized_image_url || null,
      videoUrl: rawAny.video_url || rawAny.video_hd_url || rawAny.video_sd_url || null,
      thumbnailUrl: rawAny.video_preview_image_url || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      carouselItems: Array.isArray(rawAny.cards) ? rawAny.cards.map((c: any) => ({
         headline: c.title || c.headline || undefined,
         imageUrl: c.image_url || c.original_image_url || c.resized_image_url || undefined,
         videoUrl: c.video_url || c.video_hd_url || c.video_sd_url || undefined,
         destinationUrl: c.link_url || c.destination_url || undefined
      })) : [],
    },
    delivery: {
      status,
      startedAt: startDate,
      endedAt: stopDate,
      daysRunning: runningDays,
      platforms: platformsList,
      countries: country !== "ALL" ? [country] : [],
    },
    destination: {
      url: null,
      resolvedUrl: null,
      domain: null,
      title: null,
      productName: null,
    },
    intelligence: {
      category: intel.badgeCategory,
      creativeFormat: null,
      hookType: null,
      offerType: null,
      winnerScore: intel.adjustedWinnerScore,
      labels: [intel.badgeCategory, intel.longevityLabel.split(" ")[0]],
    },
    enrichment: {
      archiveStatus: "not_requested",
      status: "pending",
      qualityScore: 0,
      lastEnrichedAt: null,
    },
    variants,
    creativeRepetition: repetition,
    brandActiveAds: null,
    rawData: sanitizedRaw,
  };

  return refineAd(baseAd);
}


