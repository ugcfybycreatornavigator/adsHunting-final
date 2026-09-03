import type { AdProvider, AdSearchFilters, AdSearchResult, Advertiser, NormalizedAd, ProviderCapabilities } from "@/lib/types";
import { daysBetween, sanitizeAdCopy } from "@/lib/utils";
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
  readonly name = "meta" as const;
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
  constructor(private config: { accessToken?: string; apiVersion?: string; defaultCountry?: string; timeoutMs?: number }) {}

  isConfigured(): boolean {
    return Boolean(this.config.accessToken && this.config.apiVersion && /^v\d+\.\d+$/.test(this.config.apiVersion));
  }

  private assertConfigured() {
    if (!this.config.accessToken) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "META_AD_LIBRARY_ACCESS_TOKEN is required.", 503);
    }
    if (!this.config.apiVersion || !/^v\d+\.\d+$/.test(this.config.apiVersion)) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "META_API_VERSION must look like v26.0.", 503);
    }
  }

  private timeoutMs(fallback: number) {
    return this.config.timeoutMs && Number.isFinite(this.config.timeoutMs) ? this.config.timeoutMs : fallback;
  }

  async healthCheck(): Promise<void> {
    this.assertConfigured();
    const params = new URLSearchParams({
      access_token: this.config.accessToken || "",
      ad_reached_countries: JSON.stringify([this.config.defaultCountry || "US"]),
      search_terms: "a",
      ad_active_status: "ALL",
      limit: "1",
    });
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${this.config.apiVersion}/ads_archive?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs(12_000)),
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
    this.assertConfigured();
    let markets = filters.markets && filters.markets.length > 0 
      ? filters.markets 
      : filters.country && filters.country !== "ALL" 
        ? [filters.country] 
        : [this.config.defaultCountry || "ALL"];
    
    markets = markets.map(c => c.toUpperCase());
    
    const params = new URLSearchParams({
      access_token: this.config.accessToken || "",
      ad_reached_countries: JSON.stringify(markets),
      ad_type: "ALL",
      fields,
      limit: "25",
    });

    if (filters.brand) {
      params.set("search_page_ids", JSON.stringify([filters.brand]));
    } else if (filters.query?.trim()) {
      params.set("search_terms", filters.query.trim().slice(0, 100));
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
    const format = filters.formats?.length === 1 ? filters.formats[0] : filters.mediaType;
    if (format && !["all", "carousel", "unknown"].includes(format)) {
      params.set("media_type", format.toUpperCase());
    }
    const languages = filters.languages?.length ? filters.languages : filters.language ? [filters.language] : [];
    if (languages.length) params.set("languages", JSON.stringify(languages));
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
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs(20_000)), cache: "no-store" });
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

    const ads = (payload.data ?? []).map((ad) => normalizeMetaAd(ad, markets[0] || "ALL"));
    return { ads, nextCursor: payload.paging?.cursors?.after ?? null, total: null, source: "provider" };
  }

  async getAdvertiser(id: string): Promise<Advertiser | null> {
    const result = await this.searchAds({ brand: id, status: "all" });
    const ad = result.ads.find((item) => item.advertiser?.id === id) || result.ads[0];
    if (!ad?.advertiser?.id) return null;
    return {
      id: ad.advertiser.id,
      name: ad.advertiser.name || `Meta advertiser ${ad.advertiser.id}`,
      avatarUrl: ad.advertiser.logoUrl,
      profileUrl: ad.advertiser.pageUrl,
    };
  }

  async searchPages(query: string, limit = 10): Promise<Array<{ id: string; name: string; logoUrl: string | null; username?: string; pageUrl: string | null; source: "meta" }>> {
    const result = await this.searchAds({ query, status: "all" });
    const advertisers = new Map<string, { id: string; name: string; logoUrl: string | null; pageUrl: string | null; count: number }>();

    for (const ad of result.ads) {
      const id = ad.advertiser?.id;
      if (!id) continue;
      const existing = advertisers.get(id);
      advertisers.set(id, {
        id,
        name: ad.advertiser?.name || existing?.name || `Meta advertiser ${id}`,
        logoUrl: ad.advertiser?.logoUrl || existing?.logoUrl || null,
        pageUrl: ad.advertiser?.pageUrl || existing?.pageUrl || `https://www.facebook.com/${encodeURIComponent(id)}`,
        count: (existing?.count || 0) + 1,
      });
    }

    return Array.from(advertisers.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(({ id, name, logoUrl, pageUrl }) => ({ id, name, logoUrl, pageUrl, source: "meta" as const }));
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
      name: raw.page_name || "Unknown advertiser",
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

