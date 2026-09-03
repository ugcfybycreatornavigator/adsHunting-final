/**
 * Landing Page Enrichment Stub
 * In the future, this will scrape the landing page to extract products, prices, technologies, etc.
 */
import type { RefinedAd } from "../types.ts";

export async function scrapeLandingPage(ad: RefinedAd): Promise<void> {
  // Deep enrichment will happen asynchronously
  if (ad.destination.url && !ad.destination.resolvedUrl) {
    // Stub
  }
}
