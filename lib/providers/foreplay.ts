import type {
  AdProvider,
  AdSearchFilters,
  AdSearchResult,
  MediaType,
  NormalizedAd,
  ProviderCapabilities,
} from "@/lib/types";
import { computeAdIntelligence } from "@/lib/intelligence";
import { computeAdFingerprints } from "@/lib/fingerprint";
import { daysBetween, safeExternalUrl, sanitizeAdCopy } from "@/lib/utils";
import { ProviderError, providerErrorFromStatus } from "@/lib/providers/errors";

type UnknownRecord = Record<string, unknown>;

const OFFICIAL_BASE_URL = "https://public.api.foreplay.co";

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter((item): item is string => Boolean(item)) : [];
}

function dateFromValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1_000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const valueText = text(value);
  if (!valueText) return null;
  const date = new Date(valueText);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mediaTypeFor(format: string | null, video: string | null, image: string | null, assets: string[]): MediaType {
  const normalized = format?.toLowerCase() || "";
  if (normalized === "carousel" || normalized.startsWith("multi_") || assets.length > 1) return "carousel";
  if (video || normalized === "video") return "video";
  if (image || normalized === "image") return "image";
  return "unknown";
}

export function normalizeForeplayAd(input: UnknownRecord): NormalizedAd {
  const cards = Array.isArray(input.cards) ? input.cards.map(record) : [];
  const video = safeExternalUrl(text(input.video));
  const image = safeExternalUrl(text(input.image));
  const thumbnail = safeExternalUrl(text(input.thumbnail));
  const carouselAssets = cards
    .flatMap((card) => [safeExternalUrl(text(card.video)), safeExternalUrl(text(card.image))])
    .filter((item): item is string => Boolean(item));
  const assets = [...new Set(carouselAssets)];
  const mediaType = mediaTypeFor(text(input.display_format), video, image, assets);
  const sourceMediaUrl = mediaType === "video" ? video : mediaType === "carousel" ? assets[0] || image || video : image || video;
  const started = dateFromValue(input.started_running);
  const live = typeof input.live === "boolean" ? input.live : null;
  const status = live === true ? "active" as const : live === false ? "inactive" as const : "unknown" as const;
  const now = new Date().toISOString();
  const body = sanitizeAdCopy(text(input.description));
  const headline = sanitizeAdCopy(text(input.headline) || text(input.name));
  const advertiserId = text(input.brand_id) || "unknown";
  const advertiserName = text(input.name) || "Unknown advertiser";
  const cta = text(input.cta_title) || text(input.cta_type);
  const landingPageUrl = safeExternalUrl(text(input.link_url));
  const platforms = stringArray(input.publisher_platform).map((item) => item.toLowerCase());
  const runningDays = daysBetween(started, null);
  const intelligence = computeAdIntelligence({
    startDate: started, stopDate: null, status, lastSeenAt: now, variants: 1,
    creativeRepetition: 0, platforms, mediaType, headline, body, cta,
    landingPageUrl, sourceMediaUrl, advertiserId,
  });
  const externalAdId = text(input.ad_id) || text(input.id) || crypto.randomUUID();

  const baseAd: NormalizedAd = {
    id: text(input.id) || externalAdId,
    externalId: externalAdId,
    provider: {
      discoveryProvider: "foreplay",
      fetchedAt: now,
    },
    advertiser: {
      id: advertiserId,
      name: advertiserName,
      normalizedName: null,
      pageUrl: null,
      logoUrl: safeExternalUrl(text(input.avatar)),
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: body,
      headline,
      description: sanitizeAdCopy(text(input.full_transcription)),
      cta,
    },
    creative: {
      type: mediaType,
      imageUrl: image,
      videoUrl: video,
      thumbnailUrl: thumbnail || (mediaType === "image" ? image : null),
      carouselItems: cards.map((card) => ({
        imageUrl: safeExternalUrl(text(card.image)) ?? undefined,
        videoUrl: safeExternalUrl(text(card.video)) ?? undefined,
        headline: text(card.headline) ?? undefined,
        destinationUrl: safeExternalUrl(text(card.link_url)) ?? undefined,
      })),
    },
    delivery: {
      status,
      startedAt: started,
      endedAt: null,
      daysRunning: runningDays,
      platforms,
      countries: [],
    },
    destination: {
      url: landingPageUrl,
      resolvedUrl: null,
      domain: null,
      title: null,
      productName: null,
    },
    intelligence: {
      category: null,
      creativeFormat: null,
      hookType: null,
      offerType: null,
      winnerScore: intelligence.adjustedWinnerScore,
      labels: [intelligence.badgeCategory, intelligence.longevityLabel.split(" ")[0]],
    },
    enrichment: {
      archiveStatus: "not_requested",
      status: "pending",
      qualityScore: intelligence.adjustedWinnerScore,
      lastEnrichedAt: null,
    },
    variants: 1,
    creativeRepetition: 0,
    brandActiveAds: null,
    rawData: input,
  };

  const fps = computeAdFingerprints(baseAd);

  return {
    ...baseAd,
  } as NormalizedAd;
}

export class ForeplayProvider implements AdProvider {
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true, advertiserSearch: false, commercialAds: true,
    pagination: true, demographics: false, copy: true, landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "UNSUPPORTED",
    languages: "NATIVE",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };

  constructor(private apiKey: string) {}

  private async request(path: string, parameters?: URLSearchParams) {
    const url = `${OFFICIAL_BASE_URL}${path}${parameters?.size ? `?${parameters}` : ""}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: this.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000), cache: "no-store",
      });
    } catch {
      throw new ProviderError("FOREPLAY_UNAVAILABLE", "Foreplay is temporarily unavailable.", 502);
    }
    const payload = record(await response.json().catch(() => ({})));
    if (!response.ok) {
      if (response.status === 402) throw new ProviderError("FOREPLAY_QUOTA_EXCEEDED", "Foreplay credits are exhausted.", 429);
      throw providerErrorFromStatus("Foreplay", response.status);
    }
    if (payload.error || record(payload.metadata).success === false) {
      throw new ProviderError("FOREPLAY_BAD_RESPONSE", "Foreplay returned an unsuccessful response.", 502);
    }
    return { payload, creditsRemaining: response.headers.get("x-credits-remaining") };
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    const params = new URLSearchParams({ limit: "20" });
    if (filters.query?.trim()) params.set("query", filters.query.trim());
    
    let activeStatus = filters.status;
    if (filters.statuses && filters.statuses.length > 0) {
      if (filters.statuses.includes("active") && !filters.statuses.includes("inactive")) activeStatus = "active";
      else if (filters.statuses.includes("inactive") && !filters.statuses.includes("active")) activeStatus = "inactive";
      else activeStatus = "all";
    }
    if (activeStatus && activeStatus !== "all") params.set("live", activeStatus === "active" ? "true" : "false");
    
    const mediaType = filters.mediaType;
    if (filters.formats && filters.formats.length > 0) {
      filters.formats.forEach(f => {
        if (f !== "unknown") params.append("display_format", f);
      });
    } else if (mediaType && String(mediaType) !== "all" && mediaType !== "unknown") {
      params.append("display_format", mediaType);
    }
    
    filters.platforms?.forEach((platform) => params.append("publisher_platform", platform));
    
    if (filters.languages && filters.languages.length > 0) {
      filters.languages.forEach(l => params.append("languages", l));
    } else if (filters.language) {
      params.append("languages", filters.language);
    }
    
    if (filters.startDate) params.set("start_date", filters.startDate);
    if (filters.endDate) params.set("end_date", filters.endDate);
    if (filters.cursor) params.set("cursor", filters.cursor);
    params.set("order", filters.sort === "oldest" ? "oldest" : filters.sort === "longest" ? "longest_running" : filters.sort === "relevant" ? "most_relevant" : "newest");
    
    if (filters.runtime) {
      if (filters.runtime.minDays !== undefined) params.set("running_duration_min_days", String(filters.runtime.minDays));
      if (filters.runtime.maxDays !== undefined) params.set("running_duration_max_days", String(filters.runtime.maxDays));
    } else {
      const duration = durationBounds(filters.duration);
      if (duration.min !== undefined) params.set("running_duration_min_days", String(duration.min));
      if (duration.max !== undefined) params.set("running_duration_max_days", String(duration.max));
    }

    const { payload } = await this.request("/api/discovery/ads", params);
    const data = Array.isArray(payload.data) ? payload.data.map(record) : [];
    let ads = data.map(normalizeForeplayAd);
    if (filters.cta) ads = ads.filter((ad) => ad.copy.cta?.toLowerCase() === filters.cta?.toLowerCase());
    const metadata = record(payload.metadata);
    const cursor = typeof metadata.cursor === "string" || typeof metadata.cursor === "number" ? String(metadata.cursor) : null;
    return { ads, nextCursor: cursor, total: typeof metadata.count === "number" ? metadata.count : null, source: "provider" };
  }

  async getAd(id: string) {
    const { payload } = await this.request(`/api/ad/${encodeURIComponent(id)}`);
    const data = Array.isArray(payload.data) ? record(payload.data[0]) : record(payload.data);
    return Object.keys(data).length ? normalizeForeplayAd(data) : null;
  }

  async healthCheck() {
    await this.request("/api/usage");
  }
}

function durationBounds(value?: string) {
  if (!value) return {};
  if (value === "today") return { min: 0, max: 1 };
  if (value === "90+") return { min: 91 };
  const match = /^(\d+)-(\d+)$/.exec(value);
  return match ? { min: Number(match[1]), max: Number(match[2]) } : {};
}
