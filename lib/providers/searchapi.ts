import type { AdProvider, AdSearchFilters, AdSearchResult, Advertiser, MediaType, NormalizedAd, ProviderCapabilities } from "@/lib/types";
import { daysBetween, safeExternalUrl, extractAdvertiserName, sanitizeAdCopy } from "@/lib/utils";
import { ProviderError, providerErrorFromStatus } from "@/lib/providers/errors";
import { computeAdIntelligence } from "@/lib/intelligence";
import { refineAd } from "@/lib/refinement";

type UnknownRecord = Record<string, unknown>;

type SearchApiKeyState = {
  disabled: boolean;
  cooldownUntil: number;
};

const keyStates = new Map<string, SearchApiKeyState>();
let nextKeyIndex = 0;
const TRANSIENT_COOLDOWN_MS = 30_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 15 * 60_000;
const REQUEST_BUDGET_MS = 30_000;
const PER_KEY_TIMEOUT_MS = 12_000;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const nestedText = value && typeof value === "object" ? (value as UnknownRecord).text : null;
  if (typeof nestedText === "string") return nestedText.trim() || null;
  return null;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() && value.trim() !== "[object Object]") {
      return value.trim();
    }
    if (value && typeof value === "object") {
      const rec = value as Record<string, unknown>;
      if (typeof rec.text === "string" && rec.text.trim()) {
        return rec.text.trim();
      }
    }
  }
  return null;
}

function normalizeCta(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  const map: Record<string, string> = {
    SHOP_NOW: "Shop now",
    LEARN_MORE: "Learn more",
    SIGN_UP: "Sign up",
    GET_OFFER: "Get offer",
    SUBSCRIBE: "Subscribe",
    WATCH_MORE: "Watch more",
    APPLY_NOW: "Apply now",
    BOOK_TRAVEL: "Book travel",
    CONTACT_US: "Contact us",
    DOWNLOAD: "Download",
    GET_QUOTE: "Get quote",
    INSTALL_APP: "Install app",
    LISTEN_NOW: "Listen now",
    PLAY_GAME: "Play game",
    SEE_MORE: "See more",
    SEND_MESSAGE: "Send message",
    USE_APP: "Use app",
  };
  if (map[normalized]) return map[normalized];
  if (normalized === normalized.toUpperCase() && normalized.includes("_")) {
    return normalized.replace(/_/g, " ").toLowerCase().replace(/^\\w/, c => c.toUpperCase());
  }
  return normalized;
}

function creativeFromSnapshot(snapshot: UnknownRecord) {
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards.map(record) : [];
  const firstCard = record(cards[0]);
  
  // Videos array
  const videos = Array.isArray(snapshot.videos) ? snapshot.videos.map(record) : [];
  const firstVideo = record(videos[0] || firstCard.video || firstCard);
  
  // Images array
  const images = Array.isArray(snapshot.images) ? snapshot.images.map(record) : [];
  const firstImage = record(images[0] || firstCard);

  // Try multiple possible video URL field names
  const videoUrl = safeExternalUrl(
    text(firstVideo.video_hd_url) || text(firstVideo.video_sd_url) ||
    text(firstVideo.video_url) || text(firstVideo.source) ||
    text(snapshot.video_hd_url) || text(snapshot.video_sd_url) ||
    text(snapshot.video_url) || text(snapshot.source_url) ||
    text(snapshot.source_media_url)
  );

  // Try multiple possible image URL field names
  const imageUrl = safeExternalUrl(
    text(firstImage.original_image_url) || text(firstImage.resized_image_url) ||
    text(firstImage.image_url) || text(firstImage.url) ||
    text(snapshot.original_image_url) || text(snapshot.resized_image_url) ||
    text(snapshot.image_url) || text(snapshot.url) ||
    text(snapshot.preview_url) || text(snapshot.thumbnail_url)
  );

  // Try multiple possible thumbnail URL field names
  const thumbnailUrl = safeExternalUrl(
    text(firstVideo.video_preview_image_url) || text(firstVideo.thumbnail_url) || text(firstVideo.poster_url) ||
    text(snapshot.video_preview_image_url) || text(snapshot.thumbnail_url) || text(snapshot.poster_url) ||
    imageUrl || videoUrl
  );

  const display = String(snapshot.display_format || "").toLowerCase();
  
  // Build carousel assets from cards or images
  let carouselAssets: string[] = [];
  if (cards.length > 1) {
    carouselAssets = cards.flatMap((card) => {
      const v = record(card.video || card);
      return [
        text(v.video_hd_url), text(v.video_sd_url), text(v.video_url), text(v.source),
        text(card.original_image_url), text(card.resized_image_url), text(card.image_url), text(card.url)
      ];
    }).map(safeExternalUrl).filter((value): value is string => Boolean(value));
  } else if (images.length > 1) {
    carouselAssets = images.flatMap((img) => [
      text(img.original_image_url), text(img.resized_image_url), text(img.image_url), text(img.url)
    ]).map(safeExternalUrl).filter((value): value is string => Boolean(value));
  } else if (videos.length > 1) {
    carouselAssets = videos.flatMap((vid) => [
      text(vid.video_hd_url), text(vid.video_sd_url), text(vid.video_url), text(vid.source)
    ]).map(safeExternalUrl).filter((value): value is string => Boolean(value));
  }
  
  const hasVideo = Boolean(videoUrl) || display.includes("video");
  const isCarousel = cards.length > 1 || images.length > 1 || videos.length > 1;

  const mediaType: MediaType = 
    isCarousel ? "carousel" : hasVideo ? "video" : imageUrl ? "image" : "unknown";

  return { firstCard, videoUrl, imageUrl, thumbnailUrl, mediaType, carouselAssets: [...new Set(carouselAssets)] };
}

export function normalizeSearchApiAd(input: UnknownRecord, country?: string): NormalizedAd {
  const snapshot = record(input.snapshot);
  const creative = creativeFromSnapshot(snapshot);
  
  const rawActive = input.active_status ? String(input.active_status).toLowerCase() : null;
  const active = rawActive === "active" || rawActive === "all" || Boolean(input.is_active) || (!text(input.end_date) && !text(input.stop_date));
  
  const startDate = firstNonEmpty(input.start_date, input.started_running, input.ad_delivery_start_time, input.first_delivery_date);
  const stopDate = active ? null : firstNonEmpty(input.stop_date, input.end_date, input.ad_delivery_stop_time);
  
  const runningDays = daysBetween(startDate, stopDate);
  const variants = Math.max(1, Number(input.collation_count) || 1);
  const repetition = Math.max(0, variants - 1);
  
  const bodyText = sanitizeAdCopy(firstNonEmpty(
    input.body, input.ad_creative_body, snapshot.body, creative.firstCard.body, input.text, input.caption, snapshot.caption
  ));

  
  const headlineText = sanitizeAdCopy(firstNonEmpty(
    input.headline, input.title, input.link_title, snapshot.headline, snapshot.title, snapshot.link_title, creative.firstCard.headline, creative.firstCard.title, creative.firstCard.link_title, input.ad_creative_link_title
  ));
  
  const ctaText = normalizeCta(firstNonEmpty(
    input.cta, input.cta_text, input.cta_type, snapshot.cta, snapshot.cta_text, snapshot.cta_type, creative.firstCard.cta_text, creative.firstCard.cta_type, creative.firstCard.cta
  ));
  
  const landingUrl = safeExternalUrl(firstNonEmpty(input.link_url, snapshot.link_url, creative.firstCard.link_url, input.destination_url));
  
  const descText = sanitizeAdCopy(firstNonEmpty(
    input.description, input.link_description, snapshot.description, snapshot.link_description, creative.firstCard.description, creative.firstCard.link_description, input.ad_creative_link_description
  ));
  
  const rawPlatforms = Array.isArray(input.publisher_platform) ? input.publisher_platform
    : Array.isArray(input.platforms) ? input.platforms
    : Array.isArray(input.placements) ? input.placements : [];
    
  const platformsList = [...new Set(rawPlatforms.map((p: unknown) => String(p).toLowerCase()))];

  const rawCards = Array.isArray(input.cards) ? input.cards.map(record) 
                 : Array.isArray(snapshot.cards) ? snapshot.cards.map(record) : [];
                 
  const carouselCards = rawCards.map(c => ({
    headline: firstNonEmpty(c.title, c.headline, c.link_title),
    description: firstNonEmpty(c.description, c.link_description),
    body: firstNonEmpty(c.body, c.caption),
    callToAction: normalizeCta(firstNonEmpty(c.cta_text, c.cta_type, c.cta)),
    imageUrl: safeExternalUrl(firstNonEmpty(c.original_image_url, c.resized_image_url, c.image_url)),
    videoUrl: safeExternalUrl(firstNonEmpty(c.video_hd_url, c.video_sd_url, c.video_url)),
    destinationUrl: safeExternalUrl(firstNonEmpty(c.link_url, c.destination_url)),
  }));

  const intel = computeAdIntelligence({
    startDate,
    stopDate,
    status: active ? "active" : "inactive",
    lastSeenAt: new Date().toISOString(),
    variants,
    creativeRepetition: repetition,
    platforms: platformsList,
    mediaType: creative.mediaType,
    headline: headlineText,
    body: bodyText,
    cta: ctaText,
    landingPageUrl: landingUrl,
    sourceMediaUrl: creative.videoUrl || creative.imageUrl,
    advertiserId: text(input.page_id) || text(snapshot.page_id) || undefined,
  });

  const baseAd: NormalizedAd = {
    id: String(input.ad_archive_id),
    externalId: String(input.ad_archive_id),
    provider: {
      discoveryProvider: "searchapi",
      fetchedAt: new Date().toISOString(),
    },
    advertiser: {
      id: text(input.page_id) || text(snapshot.page_id) || null,
      name: extractAdvertiserName([text(input.page_name), text(snapshot.page_name), text(snapshot.current_page_name)]),
      normalizedName: null,
      logoUrl: safeExternalUrl(text(input.page_profile_picture_url) || text(snapshot.page_profile_picture_url) || text(input.logo_url) || text(input.profile_picture_url)),
      pageUrl: safeExternalUrl(text(snapshot.page_profile_uri)),
      domain: null,
      social: { facebook: null, instagram: null, linkedin: null },
    },
    copy: {
      primaryText: bodyText,
      headline: headlineText,
      description: descText,
      cta: ctaText,
    },
    creative: {
      type: creative.mediaType,
      imageUrl: creative.imageUrl || null,
      videoUrl: creative.videoUrl || null,
      thumbnailUrl: creative.thumbnailUrl,
      carouselItems: carouselCards.length > 0 ? carouselCards.map(c => ({
        headline: c.headline || undefined,
        imageUrl: c.imageUrl || undefined,
        videoUrl: c.videoUrl || undefined,
        destinationUrl: c.destinationUrl || undefined
      })) : creative.carouselAssets.map(asset => ({
        imageUrl: asset.match(/\.(mp4|webm|mov)$/i) ? undefined : asset,
        videoUrl: asset.match(/\.(mp4|webm|mov)$/i) ? asset : undefined,
      })),
    },
    delivery: {
      status: active ? "active" : "inactive",
      startedAt: startDate,
      endedAt: stopDate,
      daysRunning: runningDays,
      platforms: platformsList,
      countries: country ? [country] : [],
    },
    destination: {
      url: landingUrl,
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
      labels: [intel.badgeCategory, intel.longevityLabel.split(" ")[0]].filter(Boolean) as string[],
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
    rawData: input,
  };
  
  return refineAd(baseAd);
}

export class SearchApiProvider implements AdProvider {
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true, advertiserSearch: true, commercialAds: true,
    pagination: true, demographics: true, copy: true, landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "NATIVE",
    languages: "NATIVE",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };
  private endpoint = "https://www.searchapi.io/api/v1/search";
  private apiKeys: string[];

  constructor(apiKeys: string | string[]) {
    this.apiKeys = [...new Set((Array.isArray(apiKeys) ? apiKeys : [apiKeys]).map((key) => key.trim()).filter(Boolean))];
    if (!this.apiKeys.length) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "At least one SearchAPI key is required.", 503);
    }
  }

  private async request(body: UnknownRecord): Promise<UnknownRecord> {
    const keys = this.availableKeys();
    const serializedBody = JSON.stringify(body);
    const deadline = Date.now() + REQUEST_BUDGET_MS;
    let lastError: ProviderError | null = null;

    for (const apiKey of keys) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      let response: Response;
      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: serializedBody,
          signal: AbortSignal.timeout(Math.min(PER_KEY_TIMEOUT_MS, remainingMs)),
          cache: "no-store",
        });
      } catch {
        this.cooldown(apiKey, TRANSIENT_COOLDOWN_MS);
        lastError = new ProviderError(
          "PROVIDER_UNAVAILABLE",
          "SearchAPI request failed before a response was received.",
          502
        );
        continue;
      }

      const payload = record(await response.json().catch(() => ({})));
      if (response.ok) {
        keyStates.delete(apiKey);
        return payload;
      }

      const message =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
          ? payload.message
          : undefined;
      lastError = providerErrorFromStatus("SearchAPI", response.status, message);

      if (response.status === 401) {
        keyStates.set(apiKey, { disabled: true, cooldownUntil: Number.POSITIVE_INFINITY });
        continue;
      }
      if (response.status === 403) {
        this.cooldown(apiKey, MAX_RATE_LIMIT_COOLDOWN_MS);
        continue;
      }
      if (response.status === 429) {
        this.cooldown(apiKey, retryDelayMs(response, message));
        continue;
      }
      if (response.status >= 500) {
        this.cooldown(apiKey, TRANSIENT_COOLDOWN_MS);
        continue;
      }

      // Retrying another credential cannot fix an invalid query or missing resource.
      throw lastError;
    }

    throw lastError ?? this.poolUnavailableError();
  }

  private availableKeys() {
    const now = Date.now();
    const start = nextKeyIndex++ % this.apiKeys.length;
    const ordered = this.apiKeys.map((_, offset) => this.apiKeys[(start + offset) % this.apiKeys.length]);
    const available = ordered.filter((key) => {
      const state = keyStates.get(key);
      return !state?.disabled && (!state?.cooldownUntil || state.cooldownUntil <= now);
    });
    if (!available.length) throw this.poolUnavailableError();
    return available;
  }

  private cooldown(apiKey: string, delayMs: number) {
    keyStates.set(apiKey, { disabled: false, cooldownUntil: Date.now() + delayMs });
  }

  private poolUnavailableError() {
    const states = this.apiKeys.map((key) => keyStates.get(key));
    const allDisabled = states.every((state) => state?.disabled);
    return allDisabled
      ? new ProviderError("SEARCHAPI_AUTH_ERROR", "All configured SearchAPI keys are invalid or expired.", 401)
      : new ProviderError("SEARCHAPI_RATE_LIMIT", "All configured SearchAPI keys are temporarily cooling down.", 429);
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    const searchQuery = filters.query?.trim();
    if (!searchQuery && !filters.brand) {
      throw new ProviderError("MISSING_QUERY", "A search keyword or brand is required for ad discovery.", 400);
    }
    
    // Resolve multiple values
    let activeStatus = "all";
    if (filters.statuses && filters.statuses.length > 0) {
      if (filters.statuses.includes("active") && !filters.statuses.includes("inactive")) activeStatus = "active";
      else if (filters.statuses.includes("inactive") && !filters.statuses.includes("active")) activeStatus = "inactive";
    } else if (filters.status && filters.status !== "all") {
      activeStatus = filters.status;
    }

    let mediaType = "all";
    if (filters.formats && filters.formats.length > 0) {
      if (filters.formats.includes("carousel")) mediaType = "image_and_meme";
      else if (filters.formats.includes("video")) mediaType = "video";
      else if (filters.formats.includes("image")) mediaType = "image";
    } else if (filters.mediaType && filters.mediaType !== "all") {
      mediaType = filters.mediaType === "carousel" ? "image_and_meme" : filters.mediaType;
    }

    const contentLanguages = filters.languages?.length ? filters.languages.join(",") : filters.language || undefined;

    const markets = filters.markets?.length 
      ? filters.markets 
      : filters.country && filters.country !== "ALL" 
        ? [filters.country] 
        : ["ALL"];

    let allAds: NormalizedAd[] = [];
    let nextCursor: string | null = null;
    let total: number | null = null;

    // SearchAPI only supports one country at a time, so we iterate for multi-market selections
    // We limit to 3 markets to prevent quota exhaustion in a single search, or just run them.
    const marketsToFetch = markets.slice(0, 3); 

    for (const country of marketsToFetch) {
      const body: UnknownRecord = {
        engine: "meta_ad_library",
        q: searchQuery,
        country: country,
        active_status: activeStatus,
        media_type: mediaType,
        platforms: filters.platforms?.length ? filters.platforms.join(",") : undefined,
        content_languages: contentLanguages,
        start_date: filters.startDate || undefined,
        end_date: filters.endDate || undefined,
        sort_by: filters.sort === "newest" ? "most_recent" : "impressions_high_to_low",
        page_id: filters.selectedBrand?.provider === "meta"
          ? filters.selectedBrand.providerAdvertiserId
          : filters.brand || undefined,
        next_page_token: filters.cursor || undefined,
      };
      Object.keys(body).forEach((key) => body[key] === undefined && delete body[key]);
      
      const payload = await this.request(body);
      const parsedAds = Array.isArray(payload.ads)
        ? payload.ads.map((ad) => normalizeSearchApiAd(record(ad), country))
        : [];
      
      allAds = [...allAds, ...parsedAds];
      
      const pagination = record(payload.pagination);
      const information = record(payload.search_information);
      
      // If we are doing multi-market, pagination gets tricky. We'll only return the cursor of the first market.
      // This is a known limitation of multi-region searches without a unified provider cursor.
      if (!nextCursor && text(pagination.next_page_token)) {
        nextCursor = text(pagination.next_page_token);
      }
      if (typeof information.total_results === "number") {
        total = (total || 0) + information.total_results;
      }
    }

    // Deduplicate cross-region ads
    const seen = new Set<string>();
    allAds = allAds.filter((ad) => {
      if (seen.has(ad.externalId || ad.id)) return false;
      seen.add(ad.externalId || ad.id);
      return true;
    });

    if (filters.cta) allAds = allAds.filter((ad: NormalizedAd) => ad.copy.cta?.toLowerCase() === filters.cta?.toLowerCase());
    
    // Support advanced runtime filter
    if (filters.runtime) {
      allAds = allAds.filter((ad: NormalizedAd) => {
        if (ad.delivery.daysRunning === null) return false;
        if (filters.runtime!.minDays !== undefined && ad.delivery.daysRunning! < filters.runtime!.minDays) return false;
        if (filters.runtime!.maxDays !== undefined && ad.delivery.daysRunning! > filters.runtime!.maxDays) return false;
        return true;
      });
    } else if (filters.duration) {
      allAds = allAds.filter((ad: NormalizedAd) => durationMatches(ad.delivery.daysRunning, filters.duration!));
    }
    
    allAds = sortNormalizedAds(allAds, filters.sort);

    return {
      ads: allAds,
      nextCursor,
      total,
      source: "provider",
    };
  }

  async getAd(id: string) {
    const result = await this.searchAds({ query: `"${id}"`, status: "all" });
    return result.ads.find((ad) => (ad.externalId || ad.id) === id) ?? null;
  }

  async getAdvertiser(id: string): Promise<Advertiser | null> {
    const payload = await this.request({ engine: "meta_ad_library_page_info", page_id: id });
    const page = record(payload.page_info);
    if (!page.page_id) return null;
    return {
      id: String(page.page_id),
      name: text(page.page_name) || "Unknown page",
      avatarUrl: safeExternalUrl(text(page.profile_photo_url)),
      profileUrl: safeExternalUrl(text(page.page_uri)),
    };
  }
}

function retryDelayMs(response: Response, message?: string) {
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_RATE_LIMIT_COOLDOWN_MS);
  }
  if (retryAfterHeader) {
    const retryAt = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAt) && retryAt > Date.now()) {
      return Math.min(retryAt - Date.now(), MAX_RATE_LIMIT_COOLDOWN_MS);
    }
  }
  if (message && /quota|credit|exhaust/i.test(message)) return MAX_RATE_LIMIT_COOLDOWN_MS;
  return DEFAULT_RATE_LIMIT_COOLDOWN_MS;
}


function durationMatches(days: number | null, filter: string): boolean {
  if (days === null) return false;
  if (filter === "1-7") return days >= 1 && days <= 7;
  if (filter === "8-30") return days >= 8 && days <= 30;
  if (filter === "31-90") return days >= 31 && days <= 90;
  if (filter === "90+") return days > 90;
  return true;
}

function sortNormalizedAds(ads: NormalizedAd[], sort?: string): NormalizedAd[] {
  if (sort === "newest") {
    return [...ads].sort(
      (a, b) => new Date(b.delivery.startedAt || 0).getTime() - new Date(a.delivery.startedAt || 0).getTime()
    );
  }
  if (sort === "oldest") {
    return [...ads].sort(
      (a, b) => new Date(a.delivery.startedAt || 0).getTime() - new Date(b.delivery.startedAt || 0).getTime()
    );
  }
  if (sort === "longest") {
    return [...ads].sort((a, b) => (b.delivery.daysRunning || 0) - (a.delivery.daysRunning || 0));
  }
  return ads;
}
