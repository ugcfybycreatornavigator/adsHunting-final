declare const Deno: { env: { get(key: string): string | undefined } };
import type { AdSearchFilters, AdSearchResult, ProviderName, AdProvider } from "./types.ts";
import { ProviderError } from "./providers/errors.ts";
import { MetaProvider } from "./providers/meta.ts";
import { SearchApiProvider } from "./providers/searchapi.ts";
import { MetaApiIoProvider } from "./providers/metaapiio.ts";
import { SpyglassProvider } from "./providers/spyglass.ts";
import { ForeplayProvider } from "./providers/foreplay.ts";

const TRANSIENT_ERROR_CODES = [
  "RATE_LIMIT", "PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE", "UPSTREAM"
];

type CircuitState = {
  failures: number;
  openedAt?: number;
  status: "closed" | "open" | "half-open";
};

const circuitBreakers = new Map<string, CircuitState>();

const MAX_FAILURES = 5;
const COOLDOWN_MS = 30_000;

export type OrchestratorResult = AdSearchResult & {
  providerMeta?: {
    provider: ProviderName;
    fallbackUsed: boolean;
    fallbackReason?: string;
  };
};

function usableText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && !/^(?:unknown|null|undefined)$/i.test(value.trim());
}

export class AdsProviderOrchestrator {
  private providers: AdProvider[] = [];

  constructor() {
    const envVars = Deno.env.toObject();
    
    // Parse order configuration
    const orderStr = Deno.env.get("ADS_PROVIDER_PRIORITY") || Deno.env.get("ADS_PROVIDER_ORDER") || "meta,foreplay,searchapi";
    const order = orderStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    
    const registry = new Map<string, () => AdProvider | null>();
    
    registry.set("spyglass", () => {
      const apiKey = Deno.env.get("SPYGLASS_API_KEY");
      const enabled = Deno.env.get("SPYGLASS_ENABLED") === "true";
      if (apiKey && enabled) return new SpyglassProvider(apiKey, enabled);
      return null;
    });
    
    registry.set("meta", () => {
      const metaEnabled = Deno.env.get("META_AD_LIBRARY_ENABLED") === "true";
      const metaToken = Deno.env.get("META_AD_LIBRARY_ACCESS_TOKEN");
      const metaVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v26.0";
      if (metaEnabled && metaToken) {
        return new MetaProvider({
          accessToken: metaToken,
          apiVersion: metaVersion,
          defaultCountry: Deno.env.get("META_DEFAULT_COUNTRY") || "US",
          timeoutMs: parseInt(Deno.env.get("META_API_TIMEOUT_MS") || "5000", 10),
        });
      }
      return null;
    });
    
    registry.set("foreplay", () => {
      const apiKey = Deno.env.get("FOREPLAY_API_KEY");
      if (apiKey) return new ForeplayProvider(apiKey);
      return null;
    });
    
    registry.set("searchapi", () => {
      const searchApiKeys = Object.entries(envVars)
        .filter(([key]) => key === "SEARCHAPI_API_KEY" || key.startsWith("SEARCH_API_KEY"))
        .map((entry) => entry[1])
        .filter(Boolean);
      if (searchApiKeys.length > 0) return new SearchApiProvider(searchApiKeys);
      return null;
    });
    
    registry.set("metaapiio", () => {
      const metaApiIoKey = Deno.env.get("METAAPI_IO_API_KEY");
      if (metaApiIoKey) return new MetaApiIoProvider(metaApiIoKey);
      return null;
    });
    
    const configuredOrder = [...new Set(order)];
    
    for (const providerName of configuredOrder) {
      if (!registry.has(providerName)) {
        console.warn(`[Orchestrator] Unknown ads provider ignored: ${providerName}`);
        continue;
      }
      const factory = registry.get(providerName);
      if (factory) {
        const instance = factory();
        if (instance) this.providers.push(instance);
      }
    }
  }

  private isCircuitOpen(providerName: string): boolean {
    const state = circuitBreakers.get(providerName) || { failures: 0, status: "closed" };
    if (state.status === "open") {
      if (state.openedAt && Date.now() - state.openedAt > COOLDOWN_MS) {
        state.status = "half-open";
        circuitBreakers.set(providerName, state);
        return false;
      }
      return true;
    }
    return false;
  }

  private recordSuccess(providerName: string) {
    circuitBreakers.set(providerName, { failures: 0, status: "closed" });
  }

  private recordFailure(providerName: string, isTransient: boolean) {
    if (!isTransient) return;
    const state = circuitBreakers.get(providerName) || { failures: 0, status: "closed" };
    state.failures += 1;
    if (state.failures >= MAX_FAILURES) {
      state.status = "open";
      state.openedAt = Date.now();
    }
    circuitBreakers.set(providerName, state);
  }

  async search(filters: AdSearchFilters, opts?: { requestId?: string }): Promise<OrchestratorResult> {
    const configuredProviders = this.providers.filter(p => p.isConfigured());

    console.info(JSON.stringify({
      event: "ads_provider_registry",
      requestId: opts?.requestId,
      configured_count: configuredProviders.length,
      officialMeta: this.providers.find(p => p.name === "meta")?.isConfigured() ?? false,
      searchApi: this.providers.find(p => p.name === "searchapi")?.isConfigured() ?? false,
      metaApiIo: this.providers.find(p => p.name === "metaapiio")?.isConfigured() ?? false,
      spyglass: this.providers.find(p => p.name === "spyglass")?.isConfigured() ?? false,
      foreplay: this.providers.find(p => p.name === "foreplay")?.isConfigured() ?? false,
      envValidation: {
        metaToken: Boolean(Deno.env.get("META_AD_LIBRARY_ACCESS_TOKEN")),
        searchApiKey: Boolean(Deno.env.get("SEARCHAPI_API_KEY")),
        metaApiIoKey: Boolean(Deno.env.get("METAAPI_IO_API_KEY"))
      }
    }));

    if (configuredProviders.length === 0) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "No providers configured", 503);
    }

    const attempts: { provider: string; error?: string }[] = [];

      const MAX_TOTAL_BUDGET_MS = 25_000;
      const orchestratorStartTime = Date.now();
      
      for (const provider of configuredProviders) {
        // Provider IDs are not interchangeable. SearchAPI uses Meta page IDs, while
        // Foreplay has its own advertiser identity namespace.
        if (filters.brand && filters.selectedBrand) {
          const supportsIdentity = filters.selectedBrand.provider === "meta"
            ? provider.name === "meta" || provider.name === "searchapi"
            : provider.name === "foreplay";
          if (!supportsIdentity) continue;
        }
        const capabilities = provider.capabilities;
        if (filters.brand && capabilities && !capabilities.advertiserSearch && !capabilities.brandSearch) continue;
        if (!filters.brand && filters.query?.trim() && capabilities && !capabilities.keywordSearch) continue;
        if (this.isCircuitOpen(provider.name)) {
          console.warn(JSON.stringify({
            event: "ads_provider_circuit_open",
            requestId: opts?.requestId,
            provider: provider.name
          }));
          continue;
        }

        const elapsedMs = Date.now() - orchestratorStartTime;
        const remainingBudget = MAX_TOTAL_BUDGET_MS - elapsedMs;
        
        // Reserve 1 second for downstream processing (persistence, serialization, normalization)
        if (remainingBudget <= 1_000) {
           break;
        }
        
        // Min of 8 seconds or the remaining budget
        const providerBudget = Math.min(8_000, remainingBudget - 1_000);

        const startTime = Date.now();
        try {
          let timeout: ReturnType<typeof setTimeout> | undefined;
          const result = await Promise.race([
            provider.searchAds(filters),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(new ProviderError("PROVIDER_TIMEOUT", "Provider exceeded budget", 504)), providerBudget);
            })
          ]).finally(() => timeout && clearTimeout(timeout));

          const usableAds = result.ads.filter(ad =>
            usableText(ad?.id) && usableText(ad.externalId) &&
            usableText(ad.advertiser?.id) && usableText(ad.advertiser?.name)
          );

          if (usableAds.length === 0) {
            attempts.push({ provider: provider.name, error: "NO_USABLE_RESULTS" });
            console.info(JSON.stringify({
              event: "ads_provider_empty",
              requestId: opts?.requestId,
              provider: provider.name,
              operation: "searchAds",
              status: "empty",
              duration: Date.now() - startTime,
              resultCount: result.ads.length,
              errorCode: "NO_USABLE_RESULTS",
              fallbackUsed: true
            }));
            continue;
          }
          
          this.recordSuccess(provider.name);

          console.info(JSON.stringify({
            event: "ads_provider_success",
            requestId: opts?.requestId,
            provider: provider.name,
            operation: "searchAds",
            status: "success",
            duration: Date.now() - startTime,
            resultCount: usableAds.length,
            errorCode: null,
            fallbackUsed: attempts.length > 0
          }));

          return {
            ...result,
            ads: usableAds,
            providerMeta: {
              provider: provider.name,
              fallbackUsed: attempts.length > 0,
              fallbackReason: attempts.length > 0 ? attempts[attempts.length - 1].error : undefined,
            }
          };
        } catch (error) {
          const providerError = error instanceof ProviderError ? error : new ProviderError("PROVIDER_UNAVAILABLE", String(error), 500);
          
          const isTransient = TRANSIENT_ERROR_CODES.includes(providerError.code) || 
                              providerError.status >= 500 || 
                              providerError.status === 429 || 
                              providerError.status === 408;

          this.recordFailure(provider.name, isTransient);

          console.error(JSON.stringify({
            event: "ads_provider_failure",
            requestId: opts?.requestId,
            provider: provider.name,
            operation: "searchAds",
            status: providerError.status,
            duration: Date.now() - startTime,
            resultCount: 0,
            errorCode: providerError.code,
            fallbackUsed: true
          }));

          attempts.push({
            provider: provider.name,
            error: providerError.code
          });

          // Failover conditions
          const shouldFailover = isTransient || 
            ["PROVIDER_FORBIDDEN", "PROVIDER_NOT_CONFIGURED", "UNKNOWN", "PROVIDER_TIMEOUT"].includes(providerError.code) ||
            providerError.status === 401 || 
            providerError.status === 403;
          
          if (!shouldFailover) {
            throw providerError;
          }
        }
      }

    const emptyAttempts = attempts.filter(attempt => attempt.error === "NO_USABLE_RESULTS");
    if (emptyAttempts.length > 0 && emptyAttempts.length === attempts.length) {
      const lastProvider = emptyAttempts[emptyAttempts.length - 1].provider as ProviderName;
      return {
        ads: [], nextCursor: null, total: 0, source: "provider",
        providerMeta: { provider: lastProvider, fallbackUsed: emptyAttempts.length > 1, fallbackReason: "NO_USABLE_RESULTS" }
      };
    }

    throw new ProviderError("PROVIDER_UNAVAILABLE", "Search is temporarily unavailable. All configured providers failed.", 503);
  }
}
