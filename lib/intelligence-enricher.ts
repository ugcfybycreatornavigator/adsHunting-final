import { computeAdIntelligence } from "./intelligence";
import type { AdIntelligenceBreakdown } from "./intelligence";

export function enrichAdWithIntelligence<T extends {
  startDate?: string | null;
  stopDate?: string | null;
  status: "active" | "inactive" | "unknown";
  lastSeenAt?: string | null;
  variants?: number;
  creativeRepetition?: number;
  platforms?: string[];
  mediaType?: string;
  headline?: string | null;
  body?: string | null;
  cta?: string | null;
  landingPageUrl?: string | null;
  sourceMediaUrl?: string | null;
  advertiserId?: string | null;
  winnerScore?: number;
  intelligenceLabels?: string[];
}>(ad: T): T & { intelligence: AdIntelligenceBreakdown } {
  const breakdown = computeAdIntelligence({
    startDate: ad.startDate,
    stopDate: ad.stopDate,
    status: ad.status,
    lastSeenAt: ad.lastSeenAt,
    variants: ad.variants,
    creativeRepetition: ad.creativeRepetition,
    platforms: ad.platforms,
    mediaType: ad.mediaType,
    headline: ad.headline,
    body: ad.body,
    cta: ad.cta,
    landingPageUrl: ad.landingPageUrl,
    sourceMediaUrl: ad.sourceMediaUrl,
    advertiserId: ad.advertiserId,
  });

  return {
    ...ad,
    winnerScore: breakdown.adjustedWinnerScore,
    intelligence: breakdown,
  };
}
