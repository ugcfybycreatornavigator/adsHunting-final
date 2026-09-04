import type {
  AdProvider,
  AdSearchFilters,
  AdSearchResult,
  ProviderCapabilities,
  BrandSearchResult,
  RefinedAd,
} from "@/lib/types";
import { ProviderError } from "@/lib/providers/errors";

interface SpyglassBrand {
  id: string | number;
  name?: string;
  thumbnailUrl?: string;
  logoUrl?: string;
  logo?: string;
  profilePicture?: string;
  avatar?: string;
  image?: string;
  category?: string;
  likes?: number;
  igFollowers?: number;
  tiktokFollowers?: number;
}

interface SpyglassAd {
  id?: string;
  type?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
  title?: string;
  description?: string;
  primaryText?: string;
  headline?: string;
  callToAction?: string;
  landingPageUrl?: string;
  destinationUrl?: string;
  brandName?: string;
  advertiserName?: string;
  brandLogoUrl?: string;
  advertiserLogoUrl?: string;
  pageUrl?: string;
  domain?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  active?: boolean;
  startAt?: string;
  startedAt?: string;
  endAt?: string;
  endedAt?: string;
  daysRun?: number;
  platforms?: string[];
  platform?: string;
  countries?: string[];
  country?: string;
  hook?: string;
  categories?: string[];
  carouselItems?: Array<{
    headline?: string;
    description?: string;
    body?: string;
    primaryText?: string;
    callToAction?: string;
    imageUrl?: string;
    mediaUrl?: string;
    videoUrl?: string;
    destinationUrl?: string;
    landingPageUrl?: string;
  }>;
}

export class SpyglassProvider implements AdProvider {
  name = "spyglass" as const;
  
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: false,
    advertiserSearch: true,
    brandSearch: true,
    commercialAds: true,
    pagination: false,
    demographics: false,
    copy: true,
    landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "UNSUPPORTED",
    languages: "UNSUPPORTED",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };

  private baseUrl = "https://app.spyglass.so/api/v1";

  constructor(private apiKey?: string, private enabled?: boolean) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.enabled);
  }

  async searchBrands(query: string): Promise<BrandSearchResult[]> {
    if (!this.isConfigured()) throw new ProviderError("PROVIDER_NOT_CONFIGURED", "Spyglass not configured.", 501);
    if (!query || query.trim().length === 0) return [];

    try {
      const response = await fetch(`${this.baseUrl}/brands/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "smart",
          query: query.trim(),
          type: "BRAND",
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderError("PROVIDER_AUTH", "Spyglass authentication failed", response.status);
        if (response.status === 429) throw new ProviderError("PROVIDER_RATE_LIMIT", "Spyglass rate limit exceeded", 429);
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass error: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.brands || !Array.isArray(data.brands)) {
        return [];
      }

      return data.brands.map((b: SpyglassBrand) => ({
        id: String(b.id),
        name: String(b.name || "Unknown Brand"),
        logoUrl: b.thumbnailUrl || b.logoUrl || b.logo || b.profilePicture || b.avatar || b.image || null,
        provider: "spyglass",
        metadata: {
          category: b.category || null,
          likes: b.likes || null,
          igFollowers: b.igFollowers || null,
          tiktokFollowers: b.tiktokFollowers || null,
        }
      }));
    } catch (error: unknown) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass fetch failed: ${msg}`, 500);
    }
  }

  async searchBrandsByName(brandNames: string[]): Promise<BrandSearchResult[]> {
    if (!this.isConfigured()) throw new ProviderError("PROVIDER_NOT_CONFIGURED", "Spyglass not configured.", 501);
    if (!brandNames || brandNames.length === 0) return [];

    try {
      const response = await fetch(`${this.baseUrl}/brands/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "brand_name",
          brandNames: brandNames,
          type: "BRAND",
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderError("PROVIDER_AUTH", "Spyglass authentication failed", response.status);
        if (response.status === 429) throw new ProviderError("PROVIDER_RATE_LIMIT", "Spyglass rate limit exceeded", 429);
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass error: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.brands || !Array.isArray(data.brands)) {
        return [];
      }

      return data.brands.map((b: SpyglassBrand) => ({
        id: String(b.id),
        name: String(b.name || "Unknown Brand"),
        logoUrl: b.thumbnailUrl || b.logoUrl || b.logo || b.profilePicture || b.avatar || b.image || null,
        provider: "spyglass",
        metadata: {
          category: b.category || null,
          likes: b.likes || null,
          igFollowers: b.igFollowers || null,
          tiktokFollowers: b.tiktokFollowers || null,
        }
      }));
    } catch (error: unknown) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass fetch failed: ${msg}`, 500);
    }
  }

  async searchAds(filters: AdSearchFilters, context?: { brandName?: string; logoUrl?: string }): Promise<AdSearchResult> {
    if (!this.isConfigured()) throw new ProviderError("PROVIDER_NOT_CONFIGURED", "Spyglass not configured.", 501);

    const brandId = filters.brand;
    let resolvedBrand: BrandSearchResult | null = null;

    if (!brandId) {
      if (filters.query) {
         throw new ProviderError("PROVIDER_UNSUPPORTED", "Spyglass does not support global keyword search.", 422);
      }
      return { ads: [], nextCursor: null, total: 0, source: "provider" };
    }

    if (context?.brandName) {
      resolvedBrand = { id: brandId, name: context.brandName, logoUrl: context.logoUrl, provider: "spyglass" };
    } else if (filters.query && brandId) {
      // Resolve brand name if needed for UI, but the intent must already be a brand search.
      const brands = await this.searchBrands(filters.query);
      resolvedBrand = brands.find(b => b.id === brandId) || null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/brands/${brandId}/media`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "structured",
          userRequest: "all ads",
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ProviderError("PROVIDER_AUTH", "Spyglass authentication failed", response.status);
        if (response.status === 429) throw new ProviderError("PROVIDER_RATE_LIMIT", "Spyglass rate limit exceeded", 429);
        if (response.status === 404) return { ads: [], nextCursor: null, total: 0, source: "provider" };
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass media error: ${response.status}`, response.status);
      }

      const data = await response.json();
      
      if (!data.media || !Array.isArray(data.media)) {
        return { ads: [], nextCursor: null, total: 0, source: "provider" };
      }

      const ads: RefinedAd[] = data.media.map((ad: SpyglassAd) => this.normalizeSpyglassAd(ad, brandId!, resolvedBrand));

      
      return {
        ads,
        nextCursor: null,
        total: ads.length,
        source: "provider"
      };
    } catch (error: unknown) {
      if (error instanceof ProviderError) throw error;
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError("PROVIDER_UNAVAILABLE", `Spyglass media fetch failed: ${msg}`, 500);
    }
  }

  private resolveSpyglassMedia(ad: SpyglassAd) {
    const rawType = ad.type || ad.mediaType || "UNKNOWN";
    const typeUpper = String(rawType).toUpperCase();
    
    let type: "image" | "video" | "carousel" | "unknown" = "unknown";
    let imageUrl = null;
    let videoUrl = null;
    const thumbnailUrl = ad.thumbnailUrl || null;
    const carouselItems: Array<{
      imageUrl?: string;
      videoUrl?: string;
      headline?: string;
      destinationUrl?: string;
    }> = [];

    if (typeUpper === "CAROUSEL") {
      type = "carousel";
      if (Array.isArray(ad.carouselItems) && ad.carouselItems.length > 0) {
        for (const item of ad.carouselItems) {
          carouselItems.push({
            headline: item.headline || undefined,
            imageUrl: item.imageUrl || item.mediaUrl || undefined,
            videoUrl: item.videoUrl || undefined,
            destinationUrl: item.destinationUrl || item.landingPageUrl || undefined,
          });
        }
      } else if (ad.mediaUrl) {
        imageUrl = ad.mediaUrl;
        carouselItems.push({
          headline: ad.title || undefined,
          imageUrl: ad.mediaUrl,
          videoUrl: undefined,
          destinationUrl: ad.landingPageUrl || undefined,
        });
      }
    } else if (typeUpper === "VIDEO") {
      type = "video";
      videoUrl = ad.mediaUrl || ad.videoUrl || null;
    } else if (typeUpper === "IMAGE") {
      type = "image";
      imageUrl = ad.mediaUrl || ad.imageUrl || null;
    } else if (ad.mediaUrl && String(ad.mediaUrl).endsWith(".mp4")) {
      type = "video";
      videoUrl = ad.mediaUrl;
    } else if (ad.mediaUrl) {
      type = "image";
      imageUrl = ad.mediaUrl;
    }

    return { type, imageUrl, videoUrl, thumbnailUrl, carouselItems };
  }

  private cyrb53(str: string, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  private normalizeSpyglassAd(ad: SpyglassAd, brandId: string, resolvedBrand: BrandSearchResult | null): RefinedAd {
    const { type, imageUrl, videoUrl, thumbnailUrl, carouselItems } = this.resolveSpyglassMedia(ad);
    
    const finalBrandName = resolvedBrand?.name || ad.brandName || ad.advertiserName || "Unknown Brand";
    const finalBrandLogo = resolvedBrand?.logoUrl || ad.brandLogoUrl || ad.advertiserLogoUrl || null;

    // Deterministic identity creation
    const providerAdId = ad.id || `sg_${this.cyrb53((imageUrl || videoUrl || ad.title || "").substring(0, 100))}`;
    
    let fingerprintInput = "";
    if (carouselItems.length > 0) {
      fingerprintInput = carouselItems.map(c => c.imageUrl || c.videoUrl || "").join("|");
    } else {
      fingerprintInput = imageUrl || videoUrl || thumbnailUrl || providerAdId;
    }
    // Clean dynamic query parameters to stabilize the hash
    try {
      const url = new URL(fingerprintInput.split("|")[0]);
      url.searchParams.delete("fbclid");
      url.searchParams.delete("timestamp");
      fingerprintInput = url.toString() + (carouselItems.length > 1 ? "|..." : "");
    } catch {}

    const creativeFingerprint = this.cyrb53(fingerprintInput).toString(36);
    const canonicalCreativeId = `spyglass:${providerAdId}:${creativeFingerprint}`;

    return {
      id: canonicalCreativeId,
      externalId: providerAdId,
      provider: {
        discoveryProvider: "spyglass",

        fetchedAt: new Date().toISOString(),
      },
      advertiser: {
        id: brandId,
        name: finalBrandName,
        normalizedName: finalBrandName.toLowerCase(),
        pageUrl: ad.pageUrl || null,
        logoUrl: finalBrandLogo,
        domain: ad.domain || null,
        social: {
          facebook: ad.facebookUrl || null,
          instagram: ad.instagramUrl || null,
          linkedin: null,
        }
      },
      copy: {
        primaryText: ad.title || ad.description || ad.primaryText || null,
        headline: ad.title || ad.headline || null,
        description: ad.description || null,
        cta: ad.callToAction || null,
      },
      creative: {
        type,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        carouselItems: carouselItems.length > 0 ? carouselItems : [],
      },
      delivery: {
        status: ad.active === false ? "inactive" : "active",
        startedAt: ad.startAt || ad.startedAt || null,
        endedAt: ad.endAt || ad.endedAt || null,
        daysRunning: ad.daysRun || null,
        platforms: Array.isArray(ad.platforms) ? ad.platforms : ad.platform ? [ad.platform] : [],
        countries: Array.isArray(ad.countries) ? ad.countries : ad.country ? [ad.country] : [],
      },
      destination: {
        url: ad.landingPageUrl || ad.destinationUrl || null,
        resolvedUrl: ad.landingPageUrl || ad.destinationUrl || null,
        domain: ad.domain || null,
        title: null,
        productName: null,
      },
      intelligence: {
        category: null,
        creativeFormat: type,
        hookType: ad.hook || null,
        offerType: null,
        winnerScore: null,
        labels: Array.isArray(ad.categories) ? ad.categories : [],
      },
      enrichment: {
        archiveStatus: "not_requested",
        status: "complete",
        qualityScore: 100,
        lastEnrichedAt: new Date().toISOString(),
      },
      rawData: ad as Record<string, unknown>
    };
  }
}
