/**
 * Signal Intelligence Engine v1.0
 * Observable Advertising Intelligence Scoring for Competitor Ads & Authorized Account Metrics.
 */

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
  const active = Math.max(1, activeVariants);
  const score = Math.round(Math.min(100, (active / 8) * 100));

  let label = "Single Test (1 variant)";
  if (active >= 8) label = "High Creative Commitment (8+ variants)";
  else if (active >= 4) label = "Strong Iteration (4–7 variants)";
  else if (active >= 2) label = "Multiple Tests (2–3 variants)";

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

export function computeAdIntelligence(input: AdIntelligenceInput): AdIntelligenceBreakdown {
  const fromMs = input.startDate ? new Date(input.startDate).getTime() : NaN;
  const toMs = input.stopDate ? new Date(input.stopDate).getTime() : Date.now();
  const runningDays = Number.isFinite(fromMs) ? Math.max(0, Math.floor((toMs - fromMs) / 86_400_000)) : null;

  const { score: longevityScore, label: longevityLabel } = calculateLongevityScore(runningDays);
  const repetitionScore = calculateRepetitionScore(input.creativeRepetition ?? 0);
  const activeVarCount = Math.max(1, input.activeVariants ?? input.variants ?? 1);
  const { score: variantScore, label: variantLabel } = calculateVariantScore(activeVarCount);

  const brandCommitmentScore = calculateBrandCommitmentScore({
    activeVariants: activeVarCount,
    formatCount: input.mediaType && input.mediaType !== "unknown" ? 2 : 1,
    platformCount: Math.max(1, input.platforms?.length ?? 1),
    runningDays: runningDays ?? 0,
  });

  const recencyScore = calculateRecencyScore(input.status, input.lastSeenAt);

  const clickPropensityScore = calculateClickPropensity({
    hasCTA: Boolean(input.cta),
    hasHeadline: Boolean(input.headline),
    hasBody: Boolean(input.body),
    bodyText: input.body,
    mediaType: input.mediaType || "unknown",
    hasLandingPage: Boolean(input.landingPageUrl),
  });

  const conversionPotentialScore = calculateConversionPotential({
    hasOffer: Boolean(input.cta || input.headline?.toLowerCase().includes("off") || input.headline?.toLowerCase().includes("%")),
    hasLandingPage: Boolean(input.landingPageUrl),
    hasCTA: Boolean(input.cta),
    hasBody: Boolean(input.body),
    bodyText: input.body,
    longevityScore,
    variantScore,
  });

  const { score: confidenceScore, label: confidenceLabel } = calculateConfidence({
    hasStartDate: Boolean(input.startDate),
    hasStatus: input.status !== "unknown",
    hasLastSeen: Boolean(input.lastSeenAt),
    hasRelatedCreatives: (input.creativeRepetition ?? 0) > 0,
    hasLandingPage: Boolean(input.landingPageUrl),
    hasMedia: Boolean(input.sourceMediaUrl),
    hasAdvertiserHistory: Boolean(input.advertiserId),
  });

  // Base Winner Score:
  // 0.35 * Longevity + 0.20 * Repetition + 0.15 * Variant + 0.10 * BrandCommitment + 0.10 * Recency + 0.10 * Quality
  const rawWinner = 
    0.35 * longevityScore +
    0.20 * repetitionScore +
    0.15 * variantScore +
    0.10 * brandCommitmentScore +
    0.10 * recencyScore +
    0.10 * clickPropensityScore;

  // Active Bonus
  let activeBonus = 0;
  if (input.status === "active" && (runningDays ?? 0) >= 30) activeBonus += 3;
  if (input.status === "active" && (runningDays ?? 0) >= 60) activeBonus += 3;
  if (input.status === "active" && (runningDays ?? 0) >= 90) activeBonus += 4;

  // Early Test Penalty
  let earlyTestPenalty = 0;
  if ((runningDays ?? 0) < 4 && activeVarCount <= 1) earlyTestPenalty = -10;
  else if ((runningDays ?? 0) < 7 && activeVarCount <= 1) earlyTestPenalty = -5;

  // Dead Creative Penalty
  let deadCreativePenalty = 0;
  if (input.status === "inactive" && (runningDays ?? 0) <= 5) deadCreativePenalty = -15;
  else if (input.status === "inactive" && (runningDays ?? 0) <= 14) deadCreativePenalty = -7;

  const winnerScore = Math.round(Math.min(100, Math.max(0, rawWinner + activeBonus + earlyTestPenalty + deadCreativePenalty)));

  // Adjusted Winner Score based on Confidence Penalty
  const adjustedWinnerScore = Math.round(Math.min(100, Math.max(0, winnerScore * (0.65 + 0.35 * (confidenceScore / 100)))));

  // Explanations
  const explanation: string[] = [];
  if (runningDays && runningDays >= 30) explanation.push(`Active for ${runningDays} days in market`);
  if (activeVarCount > 1) explanation.push(`${activeVarCount} related creative variants active`);
  if (input.status === "active") explanation.push("Currently active and running");
  if (input.landingPageUrl) explanation.push("Direct landing page attached");
  if (input.cta) explanation.push(`Clear call to action: "${input.cta}"`);
  if (confidenceScore >= 70) explanation.push("High metadata signal confidence");

  // Badge Category
  let badgeCategory: AdIntelligenceBreakdown["badgeCategory"] = "Standard";
  if (adjustedWinnerScore >= 85 && confidenceScore >= 80) badgeCategory = "High-Confidence Winner";
  else if (runningDays && runningDays >= 60 && input.status === "active") badgeCategory = "Proven Long Runner";
  else if (adjustedWinnerScore >= 65 && (runningDays ?? 0) < 30 && input.status === "active") badgeCategory = "Emerging Winner";
  else if (adjustedWinnerScore < 50) badgeCategory = "Testing";

  return {
    winnerScore,
    adjustedWinnerScore,
    scoreVersion: SCORE_VERSION,
    longevityScore,
    longevityLabel,
    repetitionScore,
    variantScore,
    variantLabel,
    brandCommitmentScore,
    recencyScore,
    clickPropensityScore,
    conversionPotentialScore,
    confidenceScore,
    confidenceLabel,
    activeBonus,
    earlyTestPenalty,
    deadCreativePenalty,
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
