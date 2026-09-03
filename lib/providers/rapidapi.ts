import type { AdProvider, AdSearchFilters, AdSearchResult, Advertiser, NormalizedAd, ProviderCapabilities } from "@/lib/types";
import { ProviderError } from "./errors";
import { getServerEnv } from "@/lib/env/server";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const nested = (value as UnknownRecord).text;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

function safeUrl(value: unknown): string | null {
  const t = text(value);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

const RAPIDAPI_HOST_DEFAULT = "facebook-pages-scraper2.p.rapidapi.com";

export class RapidApiProvider implements AdProvider {
  readonly name = "rapidapi";
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true,
    advertiserSearch: true,
    commercialAds: true,
    pagination: true,
    demographics: true,
    copy: true,
    landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "NATIVE",
    languages: "NATIVE",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };

  private key: string;
  private host: string;
  private timeoutMs = 12_000;

  constructor(key?: string, host?: string) {
    const env = getServerEnv();
    this.key = key || env.rapidApiKey || "";
    this.host = host || env.rapidApiHost || RAPIDAPI_HOST_DEFAULT;
    if (!this.key) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "RAPIDAPI_KEY is required.", 503);
    }
  }

  private async request(path: string, init?: RequestInit): Promise<UnknownRecord> {
    const url = new URL(`https://${this.host}${path}`);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-rapidapi-host": this.host,
      "x-rapidapi-key": this.key,
      ...(init?.headers as Record<string, string> | undefined),
    };

    const res = await fetch(url.toString(), {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const payload = record(await res.json().catch(() => ({})));

    if (res.ok) return payload;

    const message = typeof payload.error === "string" ? payload.error : typeof payload.message === "string" ? payload.message : undefined;
    if (res.status === 401) throw new ProviderError("PROVIDER_AUTH", "Invalid RapidAPI key.", 401);
    if (res.status === 403) throw new ProviderError("PROVIDER_FORBIDDEN", "RapidAPI permission denied.", 403);
    if (res.status === 429) throw new ProviderError("PROVIDER_RATE_LIMIT", message || "RapidAPI rate limit.", 429);
    if (res.status >= 500) throw new ProviderError("PROVIDER_UNAVAILABLE", message || "RapidAPI upstream error.", res.status);
    throw new ProviderError("PROVIDER_UNAVAILABLE", message || `RapidAPI error ${res.status}`, res.status);
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    const query = filters.query?.trim();
    const brand = filters.brand?.trim();
    if (!query && !brand) {
      throw new ProviderError("MISSING_QUERY", "Keyword or brand is required.", 400);
    }

    let allAds: NormalizedAd[] = [];
    let nextCursor: string | null = null;
    let total: number | null = null;

    if (brand) {
      const body: UnknownRecord = {
        query: "",
        ad_page_id: brand,
        country: filters.country && filters.country !== "ALL" ? filters.country : "ALL",
        activeStatus: "ALL",
        end_cursor: filters.cursor || "",
        after_time: filters.startDate || "",
        before_time: filters.endDate || "",
        sort_data: "",
      };
      Object.keys(body).forEach((k) => (body[k] === "" || body[k] === undefined) && delete body[k]);

      const payload = await this.request("/fetch_search_ads_pages", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const mapped = this.mapAdsPayload(payload);
      allAds = mapped.ads;
      nextCursor = mapped.nextCursor;
      total = mapped.total;
    } else if (query) {
      const body: UnknownRecord = {
        query,
        country: filters.country && filters.country !== "ALL" ? filters.country : "ALL",
        activeStatus: "ALL",
        end_cursor: filters.cursor || "",
        after_time: filters.startDate || "",
        before_time: filters.endDate || "",
        sort_data: "",
      };
      Object.keys(body).forEach((k) => (body[k] === "" || body[k] === undefined) && delete body[k]);

      const payload = await this.request("/fetch_search_ads_pages", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const mapped = this.mapAdsPayload(payload);
      allAds = mapped.ads;
      nextCursor = mapped.nextCursor;
      total = mapped.total;
    }

    return {
      ads: allAds,
      nextCursor,
      total,
      source: "provider",
    };
  }

  async getAd(id: string): Promise<NormalizedAd | null> {
    const result = await this.searchAds({ query: `"${id}"`, status: "all" });
    return result.ads.find((ad) => (ad.externalId || ad.id) === id) ?? null;
  }

  async getAdvertiser(id: string): Promise<Advertiser | null> {
    try {
      const payload = await this.request(`/fetch_search_pages?query=${encodeURIComponent(id)}`);
      const results = this.mapPagesPayload(payload);
      const hit = results.find((r) => r.id === id) || results[0];
      if (!hit) return null;
      return {
        id: hit.id,
        name: hit.name,
        avatarUrl: hit.logoUrl,
        profileUrl: hit.pageUrl || null,
      };
    } catch {
      return null;
    }
  }

  private mapAdsPayload(payload: UnknownRecord): { ads: NormalizedAd[]; nextCursor: string | null; total: number | null } {
    const data = record(payload.data);
    const pageInfo = record(data.page_info);
    const adsArray = Array.isArray(data.ads) ? data.ads : [];
    const groups: UnknownRecord[] = [];
    for (const group of adsArray) {
      if (Array.isArray(group)) {
        groups.push(...group.map(record));
      } else if (group && typeof group === "object") {
        groups.push(record(group));
      }
    }

    const ads: NormalizedAd[] = groups.map((ad) => {
      const snap = record(ad.snapshot);
      const cards = Array.isArray(snap.cards) ? snap.cards.map(record) : [];
      const firstCard = cards[0] ? record(cards[0]) : {};
      const images = Array.isArray(snap.images) ? snap.images.map(record) : [];
      const videos = Array.isArray(snap.videos) ? snap.videos.map(record) : [];
      const firstImage = images[0] ? record(images[0]) : firstCard;
      const firstVideo = videos[0] ? record(videos[0]) : firstCard;

      const imageUrl = safeUrl(firstImage.original_image_url || firstImage.resized_image_url || firstImage.image_url || firstImage.url || snap.preview_url || snap.thumbnail_url);
      const videoUrl = safeUrl(firstVideo.video_hd_url || firstVideo.video_sd_url || firstVideo.video_url || firstVideo.source || snap.video_url || snap.source_url);
      const thumbnailUrl = safeUrl(firstVideo.video_preview_image_url || firstVideo.thumbnail_url || firstVideo.poster_url || imageUrl || videoUrl);

      const bodyText = text(snap.body) || text(firstCard.body) || text(ad.body) || text(ad.text) || text(ad.caption);
      const headlineText = text(snap.headline) || text(snap.title) || text(firstCard.title) || text(firstCard.headline) || text(ad.headline);
      const ctaText = text(snap.cta_text) || text(firstCard.cta_text) || text(firstCard.cta) || text(ad.cta);
      const landingUrl = safeUrl(firstCard.link_url || firstCard.destination_url || snap.link_url || ad.link_url || ad.destination_url);

      const platforms = Array.isArray(ad.publisher_platform)
        ? ad.publisher_platform.map(String)
        : typeof ad.publisher_platform === "string"
          ? ad.publisher_platform.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];

      const cardItems = cards.map((c) => ({
        id: text(c.id) || undefined,
        imageUrl: safeUrl(c.original_image_url || c.resized_image_url || c.image_url || c.url) || undefined,
        videoUrl: safeUrl(c.video_hd_url || c.video_sd_url || c.video_url || c.source) || undefined,
        headline: text(c.title || c.headline || c.link_title) || undefined,
        description: text(c.description || c.link_description) || undefined,
        destinationUrl: safeUrl(c.link_url || c.destination_url) || undefined,
      }));

      const hasVideo = Boolean(videoUrl) || String(snap.display_format || "").toLowerCase().includes("video");
      const isCarousel = cards.length > 1 || images.length > 1 || videos.length > 1;
      const mediaType: NormalizedAd["creative"]["type"] = isCarousel ? "carousel" : hasVideo ? "video" : imageUrl ? "image" : "unknown";

      const startDate = text(ad.start_date) || text(ad.started_running) || text(ad.ad_delivery_start_time) || null;
      const endDate = text(ad.end_date) || text(ad.ad_delivery_stop_time) || null;
      const active = bool(ad.is_active) || ad.active_status === "active" || ad.active_status === "all" || (!endDate && !ad.stop_date);

      return {
        id: String(ad.ad_archive_id || ad.id || crypto.randomUUID()),
        externalId: String(ad.ad_archive_id || ad.id || ""),
        provider: { discoveryProvider: "rapidapi", fetchedAt: new Date().toISOString() },
        advertiser: {
          id: text(ad.page_id) || text(snap.page_id) || "",
          name: text(ad.page_name) || text(snap.page_name) || text(ad.advertiser_name) || text(snap.advertiser_name) || "Unknown advertiser",
          normalizedName: null,
          logoUrl: safeUrl(snap.page_profile_picture_url) || safeUrl(ad.page_profile_picture_url) || safeUrl(ad.advertiser_logo) || null,
          pageUrl: safeUrl(snap.page_profile_uri) || safeUrl(ad.page_url) || null,
          domain: null,
          social: { facebook: null, instagram: null, linkedin: null },
        },
        copy: {
          primaryText: bodyText || null,
          headline: headlineText || null,
          description: text(snap.description || snap.link_description || firstCard.description) || null,
          cta: ctaText || null,
        },
        creative: {
          type: mediaType,
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          carouselItems: cardItems.length > 0 ? cardItems : [],
        },
        delivery: {
          status: active ? "active" : "inactive",
          startedAt: startDate || null,
          endedAt: endDate || null,
          daysRunning: null,
          platforms,
          countries: [],
        },
        destination: {
          url: landingUrl || null,
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
          winnerScore: null,
          labels: [],
        },
        enrichment: {
          archiveStatus: "not_requested",
          status: "pending",
          qualityScore: 0,
          lastEnrichedAt: null,
        },
        variants: 1,
        creativeRepetition: 0,
        brandActiveAds: null,
        rawData: ad,
      };
    });

    const seen = new Set<string>();
    const deduped = ads.filter((ad) => {
      const key = ad.externalId || ad.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ads: deduped,
      nextCursor: text(pageInfo.end_cursor),
      total: typeof data.count === "number" ? data.count : typeof pageInfo.count === "number" ? pageInfo.count : null,
    };
  }

  async searchPages(query: string, limit = 10): Promise<{ id: string; name: string; logoUrl: string | null; username?: string; pageUrl: string | null; source: "rapidapi" }[]> {
    const payload = await this.request(`/fetch_search_pages?query=${encodeURIComponent(query)}`);
    return this.mapPagesPayload(payload).slice(0, limit);
  }

  private mapPagesPayload(payload: UnknownRecord): { id: string; name: string; logoUrl: string | null; username?: string; pageUrl: string | null; source: "rapidapi" }[] {
    const data = record(payload.data);
    const results = Array.isArray(data.results) ? data.results.map(record) : [];
    return results.map((item) => ({
      id: String(item.id || item.user_id || item.page_id || crypto.randomUUID()),
      name: String(item.name || item.title || "Unnamed Page"),
      logoUrl: safeUrl(item.profile_picture || item.image || item.avatar || item.page_picture),
      username: text(item.username || item.page_alias || item.ig_username) || undefined,
      pageUrl: safeUrl(item.url || item.page_url || item.link) || null,
      source: "rapidapi" as const,
    }));
  }
}
