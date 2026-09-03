declare const Deno: { env: { get(key: string): string | undefined } };
import type { AdSearchFilters, AdSearchResult, ProviderName, AdProvider } from "./types.ts";
import { ProviderError } from "./providers/errors.ts";
import { SpyglassProvider } from "./providers/spyglass.ts";

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

export class AdsProviderOrchestrator {
  private providers: AdProvider[] = [];

  constructor() {
    const apiKey = Deno.env.get("SPYGLASS_API_KEY");
    const enabled = Deno.env.get("SPYGLASS_ENABLED") === "true";
    const provider = new SpyglassProvider(apiKey, enabled);
    this.providers = [provider];
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
    const configuredProviders = this.providers.filter((p) => p.isConfigured?.() ?? true);

    console.info(JSON.stringify({
      event: "ads_provider_registry",
      requestId: opts?.requestId,
      configured_count: configuredProviders.length,
      spyglass: configuredProviders.some((p) => p.name === "spyglass"),
      envValidation: {
        spyglassApiKey: Boolean(Deno.env.get("SPYGLASS_API_KEY")),
        spyglassEnabled: Deno.env.get("SPYGLASS_ENABLED"),
      },
    }));

    if (configuredProviders.length === 0) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "No providers configured", 503);
    }

    const attempts: { provider: string; error?: string }[] = [];

    const MAX_TOTAL_BUDGET_MS = 15_000;
    const orchestratorStartTime = Date.now();

    for (const provider of configuredProviders) {
      if (this.isCircuitOpen(provider.name)) {
        console.warn(JSON.stringify({
          event: "ads_provider_circuit_open",
          requestId: opts?.requestId,
          provider: provider.name,
        }));
        continue;
      }

      const elapsedMs = Date.now() - orchestratorStartTime;
      const remainingBudget = MAX_TOTAL_BUDGET_MS - elapsedMs;
      if (remainingBudget <= 1_000) {
        break;
      }

      const providerBudget = Math.min(8_000, remainingBudget - 1_000);
      const startTime = Date.now();

      try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), providerBudget);

        const result = await Promise.race([
          provider.searchAds(filters),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener("abort", () => reject(new ProviderError("PROVIDER_TIMEOUT", "Provider exceeded budget", 504)));
          }),
        ]);

        clearTimeout(timeout);
        this.recordSuccess(provider.name);

        console.info(JSON.stringify({
          event: "ads_provider_success",
          requestId: opts?.requestId,
          provider: provider.name,
          durationMs: Date.now() - startTime,
          resultCount: result.ads.length,
        }));

        return {
          ...result,
          providerMeta: {
            provider: provider.name,
            fallbackUsed: attempts.length > 0,
            fallbackReason: attempts.length > 0 ? attempts[attempts.length - 1].error : undefined,
          },
        };
      } catch (error) {
        const providerError = error instanceof ProviderError ? error : new ProviderError("PROVIDER_UNAVAILABLE", String(error), 500);
        const isTransient = ["RATE_LIMIT", "PROVIDER_TIMEOUT", "PROVIDER_UNAVAILABLE", "UPSTREAM"].includes(providerError.code) ||
          providerError.status >= 500 || providerError.status === 429 || providerError.status === 408;

        this.recordFailure(provider.name, isTransient);

        console.error(JSON.stringify({
          event: "ads_provider_failure",
          requestId: opts?.requestId,
          provider: provider.name,
          code: providerError.code,
          status: providerError.status,
          durationMs: Date.now() - startTime,
          isTransient,
        }));

        attempts.push({
          provider: provider.name,
          error: providerError.code,
        });

        const shouldFailover = isTransient ||
          ["AUTH", "PERMISSION", "COVERAGE", "PROVIDER_NOT_CONFIGURED", "UNKNOWN", "PROVIDER_TIMEOUT"].includes(providerError.code) ||
          providerError.status === 401 ||
          providerError.status === 403;

        if (!shouldFailover) {
          throw providerError;
        }
      }
    }

    throw new ProviderError("PROVIDER_UNAVAILABLE", "Search is temporarily unavailable. All configured providers failed.", 503);
  }
}
