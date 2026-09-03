import type {
  AdProvider,
  AdSearchFilters,
  AdSearchResult,
  Advertiser,
  NormalizedAd,
  ProviderCapabilities,
} from "@/lib/types";
import { ProviderError } from "@/lib/providers/errors";
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

const SPYGLASS_BASE = "https://app.spyglass.so/api/v1";

export class SpyglassProvider implements AdProvider {
  readonly name = "spyglass";
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true,
    advertiserSearch: true,
    commercialAds: true,
    pagination: false,
    demographics: false,
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

  private apiKey: string;
  private enabled: boolean;
  private timeoutMs = 12_000;

  constructor(apiKey?: string, enabled?: boolean) {
    const env = getServerEnv();
    this.apiKey = apiKey || env.spyglassApiKey || "";
    this.enabled = enabled ?? env.spyglassEnabled ?? false;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.enabled);
  }

  private async request(path: string, init?: RequestInit): Promise<UnknownRecord> {
    const url = new URL(`${SPYGLASS_BASE}${path}`);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
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
    if (res.status === 401) throw new ProviderError("PROVIDER_AUTH", "Invalid Spyglass API key.", 401);
    if (res.status === 402) throw new ProviderError("OUT_OF_CREDITS", message || "Spyglass credits exhausted.", 402);
    if (res.status === 403) throw new ProviderError("PROVIDER_FORBIDDEN", message || "Spyglass permission denied.", 403);
    if (res.status === 404) throw new ProviderError("BRAND_NOT_FOUND", message || "Brand not found.", 404);
    if (res.status === 429) throw new ProviderError("PROVIDER_RATE_LIMIT", message || "Spyglass rate limit.", 429);
    if (res.status >= 500) throw new ProviderError("PROVIDER_UNAVAILABLE", message || "Spyglass upstream error.", res.status);
    throw new ProviderError("PROVIDER_BAD_REQUEST", message || `Spyglass error ${res.status}`, res.status);
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    const query = filters.query?.trim();
    const brand = filters.brand?.trim();
    if (!query && !brand) {
      throw new ProviderError("MISSING_QUERY", "Keyword or brand is required.", 400);
    }

    let resolvedBrandId = brand;
    let resolvedBrandName: string | null = null;
    let brandSearchCount = 0;

    if (query && !resolvedBrandId) {
      const searchBody: UnknownRecord = {
        mode: "brand_name",
        brandNames: [query],
        type: "BRAND",
        count: 10,
      };

      const searchPayload = await this.request("/brands/search", {
        method: "POST",
        body: JSON.stringify(searchBody),
      });

      const brands = Array.isArray((searchPayload as UnknownRecord).brands) ? ((searchPayload as UnknownRecord).brands as UnknownRecord[]) : [];
      brandSearchCount = typeof (searchPayload as UnknownRecord).count === "number" ? ((searchPayload as UnknownRecord).count as number) : brands.length;

      const exactMatch = brands.find((b) => {
        const name = text(b.name);
        return name && name.toLowerCase() === query.toLowerCase();
      });
      const fallback = brands[0];

      if (exactMatch) {
        resolvedBrandId = text(exactMatch.id) || undefined;
        resolvedBrandName = text(exactMatch.name) || query;
      } else if (fallback) {
        resolvedBrandId = text(fallback.id) || undefined;
        resolvedBrandName = text(fallback.name) || query;
      }
    }

    if (!resolvedBrandId) {
      return { ads: [], nextCursor: null, total: brandSearchCount || 0, source: "provider" };
    }

    const limit = Math.min(filters.cursor ? parseInt(filters.cursor, 10) || 25 : 25, 100);
    const userRequest = query || resolvedBrandName || resolvedBrandId;

    const mediaPayload = await this.request(`/brands/${encodeURIComponent(resolvedBrandId)}/media`, {
      method: "POST",
      body: JSON.stringify({
        mode: "structured",
        userRequest,
        limit,
      }),
    });

    const mapped = this.mapMediaPayload(mediaPayload, resolvedBrandId, resolvedBrandName);
    return {
      ads: mapped.ads,
      nextCursor: null,
      total: mapped.total,
      source: "provider",
    };
  }

  async getAd(id: string): Promise<NormalizedAd | null> {
    const result = await this.searchAds({ query: `"${id}"`, status: "all" });
    return result.ads.find((ad) => (ad.externalId || ad.id) === id) ?? null;
  }

  async getAdvertiser(id: string): Promise<Advertiser | null> {
    try {
      const payload = await this.request(`/brands/${encodeURIComponent(id)}`);
      const brand = record(payload);
      return {
        id: text(brand.id) || id,
        name: text(brand.name) || "Unknown brand",
        avatarUrl: safeUrl(brand.thumbnailUrl),
        profileUrl: null,
      };
    } catch {
      return null;
    }
  }

  private mapMediaPayload(payload: UnknownRecord, brandId?: string | null, brandName?: string | null): { ads: NormalizedAd[]; total: number | null } {
    const data = record(payload);
    const count = typeof data.count === "number" ? data.count : null;
    const mediaArray = Array.isArray(data.media) ? data.media : [];

    const ads: NormalizedAd[] = mediaArray.map((item) => {
      const m = record(item);
      const mediaTypeRaw = text(m.type) || text(m.mediaType);
      const mediaUrl = safeUrl(m.mediaUrl);
      const thumbnailUrl = safeUrl(m.thumbnailUrl);

      const hasVideo = mediaTypeRaw === "VIDEO" || Boolean(mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl));
      const isCarousel = mediaTypeRaw === "CAROUSEL" || Boolean(m.carouselCount && (m.carouselCount as number) > 1);
      const creativeType: NormalizedAd["creative"]["type"] = isCarousel ? "carousel" : hasVideo ? "video" : mediaUrl ? "image" : "unknown";

      const platforms = Array.isArray(m.platforms) ? m.platforms.map(String) : [];
      const startAt = text(m.startAt);
      const endAt = text(m.endAt);
      const daysRun = typeof m.daysRun === "number" ? m.daysRun : null;
      const active = !endAt;

      return {
        id: text(m.id) || String(Math.random()),
        externalId: text(m.id) || String(Math.random()),
        provider: { discoveryProvider: "spyglass", fetchedAt: new Date().toISOString() },
        advertiser: {
          id: brandId || "",
          name: brandName || "Unknown advertiser",
          normalizedName: null,
          logoUrl: null,
          pageUrl: null,
          domain: null,
          social: { facebook: null, instagram: null, linkedin: null },
        },
        copy: {
          primaryText: text(m.hook) || null,
          headline: text(m.title) || null,
          description: null,
          cta: null,
        },
        creative: {
          type: creativeType,
          imageUrl: !hasVideo && !isCarousel ? mediaUrl || null : null,
          videoUrl: hasVideo ? mediaUrl || null : null,
          thumbnailUrl: thumbnailUrl || null,
          carouselItems: isCarousel ? [{ imageUrl: mediaUrl || undefined, headline: text(m.title) || undefined }] : [],
        },
        delivery: {
          status: active ? "active" : "inactive",
          startedAt: startAt || null,
          endedAt: endAt || null,
          daysRunning: daysRun,
          platforms,
          countries: [],
        },
        destination: {
          url: null,
          resolvedUrl: null,
          domain: null,
          title: null,
          productName: null,
        },
        intelligence: {
          category: null,
          creativeFormat: null,
          hookType: text(m.hook) ? "hook" : null,
          offerType: null,
          winnerScore: null,
          labels: Array.isArray(m.categories) ? m.categories.map(String) : [],
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
        rawData: m,
      };
    });

    const seen = new Set<string>();
    const deduped = ads.filter((ad) => {
      const key = ad.externalId || ad.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { ads: deduped, total: count };
  }
}
