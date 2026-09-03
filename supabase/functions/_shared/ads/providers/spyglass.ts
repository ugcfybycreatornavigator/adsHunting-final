import type {
  AdProvider,
  AdSearchFilters,
  AdSearchResult,
  ProviderCapabilities,
} from "../types.ts";
import { ProviderError } from "./errors.ts";

export class SpyglassProvider implements AdProvider {
  name = "spyglass" as const;
  
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true,
    advertiserSearch: true,
    commercialAds: true,
    pagination: true,
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

  constructor(private apiKey?: string, private enabled?: boolean) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.enabled);
  }

  async searchAds(filters: AdSearchFilters): Promise<AdSearchResult> {
    throw new ProviderError("PROVIDER_NOT_CONFIGURED", "Spyglass integration slot prepared but not implemented.", 501);
  }
}
