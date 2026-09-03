import type { AdProvider, AdSearchFilters, AdSearchResult, ProviderCapabilities } from "../types.ts";
import { ProviderError } from "./errors.ts";

export class MetaApiIoProvider implements AdProvider {
  readonly name = "metaapi_io";
  
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true, advertiserSearch: true, commercialAds: true,
    pagination: true, demographics: false, copy: true, landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "NATIVE",
    languages: "NATIVE",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };

  private apiKey: string | undefined;

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async searchAds(_filters: AdSearchFilters): Promise<AdSearchResult> {
    if (!this.isConfigured()) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "MetaAPI.io is not configured.", 503);
    }
    
    // TODO: Implement the real MetaAPI.io integration here once the 
    // exact endpoint, parameters, auth format, pagination, and response schema 
    // are provided.
    // 
    // For now, this is cleanly isolated and will safely fail over.
    // We are NOT mocking fake data or guessing the schema.
    throw new ProviderError("UPSTREAM", "MetaAPI.io adapter is not yet implemented.", 501, false);
  }
}
