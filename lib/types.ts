export type AdStatus = "active" | "inactive" | "unknown";
export type MediaType = "image" | "video" | "carousel" | "unknown";

export type FilterCapability = "NATIVE" | "CACHED" | "POST_FILTER" | "UNSUPPORTED";

export type ProviderCapabilities = {
  keywordSearch: boolean;
  advertiserSearch: boolean;
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

  provider: {
    discoveryProvider: "searchapi" | "metaapi_io" | "meta_official" | "foreplay" | "catalog" | "rapidapi" | "spyglass";
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
    labels: string[];
  };

  enrichment: {
    archiveStatus: "not_requested" | "pending" | "archived" | "failed" | "unavailable";
    status: "pending" | "processing" | "complete" | "partial" | "failed";
    qualityScore: number;
    lastEnrichedAt: string | null;
  };
  
  variants?: number;
  creativeRepetition?: number;
  brandActiveAds?: number | null;
  rawData?: Record<string, unknown> | null;
  fingerprint?: string;
};

export type NormalizedAd = RefinedAd;

export interface AdSearchFilters {
  query?: string;
  brand?: string;
  platforms?: string[];
  sort?: string;
  cursor?: string;
  cta?: string;
  view?: "ads" | "brands";
  
  
  // Legacy singular properties (preserved for backward compatibility)
  status?: "all" | AdStatus;
  country?: string;
  mediaType?: "all" | MediaType;
  language?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;

  // New plural and advanced properties
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

export type SearchIntent =
  | { type: "advertiser"; advertiserId: string; advertiserName: string; }
  | { type: "keyword"; query: string; };

export interface AdSearchResult {
  ads: NormalizedAd[];
  nextCursor: string | null;
  total: number | null;
  source: "provider" | "catalog" | "cache";
  resolvedIntent?: SearchIntent;
  requestId?: string;
  stale?: boolean;
  degraded?: boolean;
}

export interface Advertiser {
  id: string;
  name: string;
  avatarUrl: string | null;
  profileUrl: string | null;
}

export interface AdProvider {
  readonly capabilities: ProviderCapabilities;
  searchAds(filters: AdSearchFilters): Promise<AdSearchResult>;
  getAd?(id: string): Promise<NormalizedAd | null>;
  getAdvertiser?(id: string): Promise<Advertiser | null>;
}

export interface SwipeFile {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  systemKey: string | null;
  adCount?: number;
  previewMedia?: string[];
  createdAt: string;
  updatedAt: string;
}

export type SharedAdContentType = "single" | "multiple" | "swipe_file";

export interface SharedAdLink {
  id: string;
  ownerUserId: string;
  name: string;
  message?: string;
  tokenHash: string;
  contentType: "single" | "multiple" | "swipe_file";
  swipeFileId?: string;
  expiresAt?: string;
  revokedAt?: string;
  visibility: "public" | "private";
  allowSave: boolean;
  allowDownload: boolean;
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string;
  status: "active" | "expired" | "disabled";
  views: number;
  itemCount: number;
}
