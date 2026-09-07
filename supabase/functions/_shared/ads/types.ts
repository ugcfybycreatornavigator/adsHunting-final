import type { BrandIdentity } from "./advertiser-identity.ts";
export type AdStatus = "active" | "inactive" | "unknown";
export type MediaType = "image" | "video" | "carousel" | "unknown";

export type FilterCapability = "NATIVE" | "CACHED" | "POST_FILTER" | "UNSUPPORTED";

export type ProviderCapabilities = {
  keywordSearch: boolean;
  advertiserSearch: boolean;
  brandSearch?: boolean;
  commercialAds: boolean;
  pagination: boolean;
  demographics: boolean;
  copy: boolean;
  landingPage: boolean;
  formats: FilterCapability;
  statuses: FilterCapability;
  markets: FilterCapability;
  languages: FilterCapability;
  niches: FilterCapability;
  contentStyles: FilterCapability;
  runtime: FilterCapability;
  videoLength: FilterCapability;
};

export interface NormalizedDemographics {
  age?: Record<string, number>;
  gender?: Record<string, number>;
  regions?: Record<string, number>;
  reach?: Record<string, number>;
}

export interface NormalizedCarouselCard {
  headline: string | null;
  description: string | null;
  body: string | null;
  callToAction: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string | null;
}

export type RefinedAd = {
  id: string;
  externalId: string | null;
  rawData?: Record<string, unknown> | null;
  fingerprint?: string;
  variants?: number;
  creativeRepetition?: number;
  brandActiveAds?: number | null;

  provider: {
    discoveryProvider: "searchapi" | "metaapi_io" | "meta_official" | "foreplay" | "spyglass" | "catalog";
    fetchedAt: string;
  };

  advertiser: {
    id: string | null;
    name: string | null;
    normalizedName: string | null;
    pageUrl: string | null;
    logoUrl: string | null;
    domain: string | null;
    social: {
      facebook: string | null;
      instagram: string | null;
      linkedin: string | null;
    };
  };

  copy: {
    primaryText: string | null;
    headline: string | null;
    description: string | null;
    cta: string | null;
  };

  creative: {
    type: MediaType;
    imageUrl: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    carouselItems: Array<{
      imageUrl?: string;
      videoUrl?: string;
      headline?: string;
      description?: string;
      body?: string;
      callToAction?: string;
      destinationUrl?: string;
    }>;
  };

  delivery: {
    status: AdStatus;
    startedAt: string | null;
    endedAt: string | null;
    daysRunning: number | null;
    platforms: string[];
    countries: string[];
  };

  destination: {
    url: string | null;
    resolvedUrl: string | null;
    domain: string | null;
    title: string | null;
    productName: string | null;
  };

  intelligence: {
    category: string | null;
    creativeFormat: string | null;
    hookType: string | null;
    offerType: string | null;
    winnerScore: number | null;
    labels?: string[];
  };

  enrichment: {
    status: "pending" | "processing" | "complete" | "partial" | "failed";
    qualityScore: number;
    lastEnrichedAt: string | null;
    archiveStatus?: "not_requested" | "requested" | "completed" | "failed";
  };
};

// Kept temporarily if some code still relies on it during migration, but should be removed eventually.
// Alias it to RefinedAd or keep the old one depending on how breaking we want this to be.
// We will migrate everything to RefinedAd.
export type NormalizedAd = RefinedAd;

export interface AdSearchFilters {
  query?: string;
  brand?: string;
  selectedBrand?: BrandIdentity;
  platforms?: string[];
  sort?: string;
  cursor?: string;
  cta?: string;
  view?: "ads" | "brands";
  
  status?: "all" | AdStatus;
  country?: string;
  mediaType?: "all" | MediaType;
  language?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;

  formats?: MediaType[];
  statuses?: AdStatus[];
  markets?: string[];
  languages?: string[];
  niches?: string[];
  contentStyles?: string[];
  
  runtime?: {
    preset?: string;
    minDays?: number;
    maxDays?: number;
  };
  
  videoLength?: {
    preset?: string;
    minSeconds?: number;
    maxSeconds?: number;
  };
}

export type ProviderName = "meta" | "searchapi" | "foreplay" | "metaapi_io" | "spyglass" | "catalog" | "meta_official";

export interface AdSearchResult {
  ads: NormalizedAd[];
  nextCursor: string | null;
  total: number | null;
  source: "provider" | "catalog";
}

export interface Advertiser {
  id: string;
  name: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}

export interface BrandSearchResult {
  id: string;
  name: string;
  logoUrl?: string | null;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface AdProvider {
  readonly name: ProviderName;
  readonly capabilities?: ProviderCapabilities;
  isConfigured(): boolean;
  searchAds(filters: AdSearchFilters): Promise<AdSearchResult>;
  searchBrands?(query: string): Promise<BrandSearchResult[]>;
}
