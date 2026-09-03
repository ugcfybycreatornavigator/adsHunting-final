/**
 * Brand Resolver Stub
 * In the future, this will enrich advertiser info by looking up social profiles, domains, etc.
 */
import type { RefinedAd } from "../types.ts";

export async function resolveBrand(ad: RefinedAd): Promise<void> {
  // Deep enrichment will happen asynchronously in background jobs
  if (!ad.advertiser.domain && ad.advertiser.pageUrl) {
    // Basic synchronous check was already done in refinement/index.ts
  }
}
