/**
 * Signal Intelligence Engine v1.0
 * Observable Advertising Intelligence Scoring for Competitor Ads & Authorized Account Metrics.
 */
import type { NormalizedAd } from "@/lib/types";

export interface AdIntelligenceInput {
  startDate?: string | null;
  stopDate?: string | null;
  status: "active" | "inactive" | "unknown";
  lastSeenAt?: string | null;
  variants?: number | null;
  creativeRepetition?: number | null;
  platforms?: string[] | null;
  mediaType?: string | null;
  headline?: string | null;
  body?: string | null;
  cta?: string | null;
  landingPageUrl?: string | null;
  sourceMediaUrl?: string | null;
  advertiserId?: string | null;
  activeVariants?: number | null;
}

export interface AdIntelligenceBreakdown {
  winnerScore: number;
  adjustedWinnerScore: number;
  scoreVersion: string;

  // Observable Subscores (0-100)
  longevityScore: number;
  longevityLabel: string;
  repetitionScore: number;
  variantScore: number;
  variantLabel: string;
  brandCommitmentScore: number;
  recencyScore: number;
  clickPropensityScore: number;
  conversionPotentialScore: number;
  confidenceScore: number;
  confidenceLabel: "Low" | "Medium" | "High" | "Very High";

  // Penalties & Bonuses
  activeBonus: number;
  earlyTestPenalty: number;
  deadCreativePenalty: number;
  runningDays: number | null;

  // Intelligence Badging
  badgeCategory: "Emerging Winner" | "Proven Long Runner" | "High-Confidence Winner" | "Testing" | "Standard";
  explanation: string[];
}

export interface AuthorizedAccountMetrics {
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  conversions?: number | null;
  cpa?: number | null;
  cvr?: number | null;
  purchaseValue?: number | null;
  roas?: number | null;
}

const SCORE_VERSION = "v1.0";

export function calculateLongevityScore(runningDays: number | null): { score: number; label: string } {
  if (runningDays == null || runningDays < 0) return { score: 0, label: "Unknown Duration" };
  
  // Nonlinear formula: 100 * min( ln(1 + runningDays) / ln(1 + 120), 1 )
  const score = Math.round(Math.min(100, Math.max(0, 100 * (Math.log(1 + runningDays) / Math.log(1 + 120)))));
  
  let label = "0–6 days (New Test)";
  if (runningDays >= 90) label = "90+ days (Exceptional Longevity)";
  else if (runningDays >= 60) label = "60–89 days (Strong Longevity)";
  else if (runningDays >= 30) label = "30–59 days (Long Runner)";
  else if (runningDays >= 14) label = "14–29 days (Promising)";
  else if (runningDays >= 7) label = "7–13 days (Early Signal)";

  return { score, label };
}

export function calculateRepetitionScore(relatedCreativeCount: number): number {
  const count = Math.max(0, relatedCreativeCount);
  // Formula: 100 * min( ln(1 + relatedCreativeCount) / ln(11), 1 )
  return Math.round(Math.min(100, Math.max(0, 100 * (Math.log(1 + count) / Math.log(11)))));
}

export function calculateVariantScore(activeVariants: number): { score: number; label: string } {
  const active = Math.max(0, activeVariants);
  const score = Math.round(Math.min(100, (active / 8) * 100));

  let label = "Single Test (1 variant)";
  if (active >= 8) label = "High Creative Commitment (8+ variants)";
  else if (active >= 4) label = "Strong Iteration (4–7 variants)";
  else if (active >= 2) label = "Multiple Tests (2–3 variants)";
  else if (active === 0) label = "No Variants";

  return { score, label };
}

export function calculateBrandCommitmentScore(input: {
  activeVariants: number;
  formatCount: number;
  platformCount: number;
  runningDays: number;
}): number {
  const normVariants = Math.min(100, (input.activeVariants / 8) * 100);
  const normFormats = Math.min(100, (input.formatCount / 3) * 100);
  const normPlatforms = Math.min(100, (input.platformCount / 4) * 100);
  const normDuration = Math.min(100, (input.runningDays / 90) * 100);

  const score = 0.45 * normVariants + 0.25 * normFormats + 0.20 * normPlatforms + 0.10 * normDuration;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateRecencyScore(status: string, lastSeenAt?: string | null): number {
  if (status === "active") return 100;
  if (!lastSeenAt) return 50;

  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenMs)) return 50;

  const daysSinceLastSeen = Math.max(0, (Date.now() - lastSeenMs) / 86_400_000);
  // Exponential decay: 100 * exp(-daysSinceLastSeen / 30)
  return Math.round(Math.min(100, Math.max(0, 100 * Math.exp(-daysSinceLastSeen / 30))));
}

export function calculateClickPropensity(input: {
  hasCTA: boolean;
  hasHeadline: boolean;
  hasBody: boolean;
  bodyText?: string | null;
  mediaType: string;
  hasLandingPage: boolean;
}): number {
  const hookScore = input.mediaType === "video" ? 85 : input.mediaType === "carousel" ? 80 : 70;
  const ctaClarityScore = input.hasCTA ? 90 : 40;
  const offerClarityScore = input.hasHeadline ? 85 : 50;
  const headlineScore = input.hasHeadline ? 85 : 45;
  const productVisibilityScore = input.hasLandingPage ? 85 : 50;
  const socialProofScore = input.hasBody && (input.bodyText?.length ?? 0) > 80 ? 80 : 50;
  const creativeStructureScore = input.hasBody ? 80 : 40;

  const score = 
    0.25 * hookScore +
    0.15 * ctaClarityScore +
    0.15 * offerClarityScore +
    0.15 * headlineScore +
    0.10 * productVisibilityScore +
    0.10 * socialProofScore +
    0.10 * creativeStructureScore;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateConversionPotential(input: {
  hasOffer: boolean;
  hasLandingPage: boolean;
  hasCTA: boolean;
  hasBody: boolean;
  bodyText?: string | null;
  longevityScore: number;
  variantScore: number;
}): number {
  const offerScore = input.hasOffer ? 85 : 50;
  const landingPageAlignment = input.hasLandingPage ? 90 : 40;
  const ctaClarity = input.hasCTA ? 85 : 45;
  const socialProof = input.hasBody && (input.bodyText?.length ?? 0) > 100 ? 80 : 50;
  const benefitClarity = input.hasOffer || input.hasBody ? 80 : 50;
  const urgencyScore = input.hasOffer ? 75 : 50;

  const score =
    0.20 * offerScore +
    0.15 * landingPageAlignment +
    0.15 * ctaClarity +
    0.15 * socialProof +
    0.10 * benefitClarity +
    0.10 * input.longevityScore +
    0.10 * input.variantScore +
    0.05 * urgencyScore;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateConfidence(input: {
  hasStartDate: boolean;
  hasStatus: boolean;
  hasLastSeen: boolean;
  hasRelatedCreatives: boolean;
  hasLandingPage: boolean;
  hasMedia: boolean;
  hasAdvertiserHistory: boolean;
}): { score: number; label: "Low" | "Medium" | "High" | "Very High" } {
  let score = 0;
  if (input.hasStartDate) score += 20;
  if (input.hasStatus) score += 20;
  if (input.hasLastSeen) score += 15;
  if (input.hasRelatedCreatives) score += 15;
  if (input.hasLandingPage) score += 10;
  if (input.hasMedia) score += 10;
  if (input.hasAdvertiserHistory) score += 10;

  score = Math.min(100, score);
  let label: "Low" | "Medium" | "High" | "Very High" = "Low";
  if (score >= 85) label = "Very High";
  else if (score >= 70) label = "High";
  else if (score >= 40) label = "Medium";

  return { score, label };
}

// The old computeAdIntelligence is removed.

// Original metrics calculations can stay for backwards compatibility where needed, but we add the authoritative Winner Score engine.

/**
 * Normalizes a URL by stripping tracking parameters, hashes, and trailing slashes.
 */
export function normalizeLandingPageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    const paramsToDelete = [];
    for (const [key] of parsed.searchParams.entries()) {
      if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === 'ref' || key === 'source') {
        paramsToDelete.push(key);
      }
    }
    paramsToDelete.forEach(p => parsed.searchParams.delete(p));
    parsed.hash = ''; // Remove fragment
    let cleanUrl = parsed.toString().toLowerCase();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl;
  } catch {
    // If it's not a valid URL, just return it lowercased and trimmed
    return url.toLowerCase().trim().replace(/\/+$/, '');
  }
}

export function calculateActiveStatusScore(status: string): number {
  return status === "active" ? 100 : 0;
}

export function calculateGeographicCoverageScore(countries: string[]): number {
  if (!countries || countries.length === 0) return 0;
  const uniqueMarkets = new Set(countries.map(c => c.toUpperCase()));
  // Max score at 5+ countries
  return Math.round(Math.min(100, (uniqueMarkets.size / 5) * 100));
}

export function calculateLandingPagePersistenceScore(ad: NormalizedAd, context: { advertiserAds: NormalizedAd[] }): number {
  const cleanCurrentUrl = normalizeLandingPageUrl(ad.destination?.url);
  if (!cleanCurrentUrl) return 0;

  // Count how many of the advertiser's active ads use this exact canonical URL
  let reuseCount = 0;
  for (const contextAd of context.advertiserAds) {
    if (contextAd.delivery.status === "active") {
      const cleanContextUrl = normalizeLandingPageUrl(contextAd.destination?.url);
      if (cleanContextUrl === cleanCurrentUrl) {
        reuseCount++;
      }
    }
  }
  // If the same LP is used in multiple active ads, they are persistent about it. Max out at 5 reuses.
  return Math.round(Math.min(100, (reuseCount / 5) * 100));
}

export function calculateCreativeRefreshPatternScore(context: { advertiserAds: NormalizedAd[] }): number {
  if (!context.advertiserAds || context.advertiserAds.length === 0) return 0;
  
  // Find ads launched in the last 30 days
  const nowMs = Date.now();
  let recentLaunches = 0;
  const uniqueFingerprints = new Set<string>();

  for (const contextAd of context.advertiserAds) {
    if (contextAd.delivery.startedAt) {
      const startMs = new Date(contextAd.delivery.startedAt).getTime();
      if (Number.isFinite(startMs)) {
        const daysAgo = (nowMs - startMs) / 86400000;
        if (daysAgo >= 0 && daysAgo <= 30) {
          // Use fingerprint, or fallback to external ID to dedupe actual creatives
          const id = contextAd.fingerprint || contextAd.externalId || contextAd.id;
          if (!uniqueFingerprints.has(id)) {
            uniqueFingerprints.add(id);
            recentLaunches++;
          }
        }
      }
    }
  }

  // Max score if they launched 5+ distinct creatives in the last 30 days
  return Math.round(Math.min(100, (recentLaunches / 5) * 100));
}

export function calculateWinnerScore(ad: NormalizedAd, context: { advertiserAds: NormalizedAd[] }): number {
  // 1. Longevity (35%)
  const { score: longevityScore } = calculateLongevityScore(ad.delivery.daysRunning);
  
  // 2. Active Status (20%)
  const activeStatusScore = calculateActiveStatusScore(ad.delivery.status);
  
  // 3. Creative Variations (15%)
  const activeVariants = ad.variants != null ? ad.variants : 1;
  const { score: creativeVariationsScore } = calculateVariantScore(activeVariants);
  
  // 4. Geographic Coverage (10%)
  const geographicCoverageScore = calculateGeographicCoverageScore(ad.delivery.countries);
  
  // 5. Landing Page Persistence (10%)
  const landingPagePersistenceScore = calculateLandingPagePersistenceScore(ad, context);
  
  // 6. Creative Refresh Pattern (10%)
  const creativeRefreshPatternScore = calculateCreativeRefreshPatternScore(context);

  const rawScore = 
    (longevityScore * 0.35) +
    (activeStatusScore * 0.20) +
    (creativeVariationsScore * 0.15) +
    (geographicCoverageScore * 0.10) +
    (landingPagePersistenceScore * 0.10) +
    (creativeRefreshPatternScore * 0.10);

  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));
  return Number.isFinite(finalScore) ? finalScore : 0;
}

// Keep computeAdIntelligence purely for badgeCategory and string labels.
// We strip the math from it affecting winnerScore, substituting it with a placeholder (0)
// which will be strictly overwritten by `calculateWinnerScore` during sync/ingestion.
export function computeAdIntelligence(input: AdIntelligenceInput): AdIntelligenceBreakdown {
  const fromMs = input.startDate ? new Date(input.startDate).getTime() : NaN;
  const toMs = input.stopDate ? new Date(input.stopDate).getTime() : Date.now();
  const runningDays = Number.isFinite(fromMs) ? Math.max(0, Math.floor((toMs - fromMs) / 86_400_000)) : null;

  const { score: longevityScore, label: longevityLabel } = calculateLongevityScore(runningDays);
  const activeVarCount = Math.max(1, input.activeVariants ?? input.variants ?? 1);
  const { score: variantScore, label: variantLabel } = calculateVariantScore(activeVarCount);
  
  const { score: confidenceScore, label: confidenceLabel } = calculateConfidence({
    hasStartDate: Boolean(input.startDate),
    hasStatus: input.status !== "unknown",
    hasLastSeen: Boolean(input.lastSeenAt),
    hasRelatedCreatives: (input.creativeRepetition ?? 0) > 0,
    hasLandingPage: Boolean(input.landingPageUrl),
    hasMedia: Boolean(input.sourceMediaUrl),
    hasAdvertiserHistory: Boolean(input.advertiserId),
  });

  const explanation: string[] = [];
  if (runningDays && runningDays >= 30) explanation.push(`Active for ${runningDays} days in market`);
  if (activeVarCount > 1) explanation.push(`${activeVarCount} related creative variants active`);
  if (input.status === "active") explanation.push("Currently active and running");
  if (input.landingPageUrl) explanation.push("Direct landing page attached");
  if (input.cta) explanation.push(`Clear call to action: "${input.cta}"`);

  let badgeCategory: AdIntelligenceBreakdown["badgeCategory"] = "Standard";
  if (runningDays && runningDays >= 60 && input.status === "active") badgeCategory = "Proven Long Runner";
  else if (runningDays && runningDays < 30 && input.status === "active") badgeCategory = "Emerging Winner";
  else if (input.status === "inactive") badgeCategory = "Testing";

  return {
    winnerScore: 0,
    adjustedWinnerScore: 0,
    scoreVersion: SCORE_VERSION,
    longevityScore,
    longevityLabel,
    repetitionScore: 0,
    variantScore,
    variantLabel,
    brandCommitmentScore: 0,
    recencyScore: 0,
    clickPropensityScore: 0,
    conversionPotentialScore: 0,
    confidenceScore,
    confidenceLabel,
    activeBonus: 0,
    earlyTestPenalty: 0,
    deadCreativePenalty: 0,
    runningDays,
    badgeCategory,
    explanation,
  };
}

export function calculateAuthorizedMetrics(metrics: AuthorizedAccountMetrics) {
  const spend = metrics.spend ?? 0;
  const impressions = metrics.impressions ?? 0;
  const clicks = metrics.clicks ?? 0;
  const conversions = metrics.conversions ?? 0;
  const purchaseValue = metrics.purchaseValue ?? 0;
  
  const ctr = metrics.ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0);
  const cpc = metrics.cpc ?? (clicks > 0 ? spend / clicks : 0);
  const cpm = metrics.cpm ?? (impressions > 0 ? (spend / impressions) * 1000 : 0);
  const cpa = metrics.cpa ?? (conversions > 0 ? spend / conversions : 0);
  const cvr = metrics.cvr ?? (clicks > 0 ? (conversions / clicks) * 100 : 0);
  const roas = metrics.roas ?? (spend > 0 ? purchaseValue / spend : 0);

  return { spend, impressions, clicks, conversions, purchaseValue, ctr, cpc, cpm, cpa, cvr, roas };
}
