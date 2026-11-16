import type { NormalizedAd } from "./types";

const SEARCH_TOKEN_MIN_LENGTH = 2;

// Explicit Discover safety policy: exclude clearly sexual/pornographic ads,
// erotic smut/webnovels, and sexually suggestive adult services. This
// is deliberately separate from relevance so ordinary fitness, health, dating,
// or body-confidence copy is not silently treated as irrelevant.
const PROHIBITED_CONTENT_PATTERNS = [
  /\bporn(?:ography|ographic)?\b/iu,
  /\bxxx\b/iu,
  /\b(?:full|explicit)\s+nudit(?:y|ies)\b/iu,
  /\bsexual(?:ly)?\s+(?:service|services|content|explicit|intercourse)\b/iu,
  /\bescort\s+service(?:s)?\b/iu,
  /\b(?:erotic|erotica)\b/iu,
  /\b(?:hentai|nsfw)\b/iu,
  /\b(?:the\s+)?lust\s+game\b/iu,
  /\b(?:seduce|seducing)\s+(?:me|women|girls|men)\b/iu,
  /\b(?:get|getting)\s+laid\b/iu,
  /\bsmack(?:ing)?\s+(?:the\s+)?(?:ass|butt|booty)\b/iu,
  /\b(?:temptation\s+gauge|scumbag\s+system)\b/iu,
];

function normalize(value?: string | null) {
  return (value || "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchTokens(query: string) {
  return [...new Set(normalize(query).split(/\s+/).filter(token => token.length >= SEARCH_TOKEN_MIN_LENGTH))];
}

function fieldsFor(ad: NormalizedAd) {
  return {
    brand: normalize(ad.advertiser?.displayName || ad.advertiser?.name),
    product: normalize(ad.destination?.productName || ad.destination?.title),
    destination: normalize(ad.destination?.url || ad.destination?.domain),
    category: normalize(ad.intelligence?.category),
    headline: normalize(ad.copy?.headline),
    body: normalize(ad.copy?.primaryText),
    description: normalize(ad.copy?.description),
    labels: normalize(ad.intelligence?.labels?.join(" ")),
  };
}

export function isContentSafeForDiscover(ad: NormalizedAd) {
  const content = [
    ad.copy?.headline,
    ad.copy?.primaryText,
    ad.copy?.description,
    ad.destination?.title,
    ad.destination?.url,
    ad.advertiser?.displayName,
    ad.advertiser?.name,
  ]
    .filter(Boolean)
    .join(" ");
  return !PROHIBITED_CONTENT_PATTERNS.some(pattern => pattern.test(content));
}

function tokenMatchesField(field: string, token: string): boolean {
  if (!field || !token) return false;
  const words = field.split(/\s+/);
  return words.some(w => (
    w === token ||
    (token.length >= 4 && w.startsWith(token)) ||
    (w.length >= 4 && token.startsWith(w))
  ));
}

function isProminentInBody(body: string, token: string, phrase: string): boolean {
  if (!body) return false;
  const openingWords = body.split(/\s+/).slice(0, 3);
  return openingWords.some(w => (
    w === token ||
    (token.length >= 4 && w.startsWith(token)) ||
    (phrase && openingWords.join(" ").startsWith(phrase))
  ));
}

export function calculateSearchRelevance(ad: NormalizedAd, query: string): number {
  const phrase = normalize(query);
  const tokens = searchTokens(query);
  if (!phrase || tokens.length === 0) return 0;

  const fields = fieldsFor(ad);
  let score = 0;
  let matchedTokens = 0;
  let strongTokenMatches = 0;

  // Exact / prefix / phrase matching with strong priority for brand, headline, product, category
  if (fields.brand === phrase) score += 220;
  else if (fields.brand.startsWith(phrase)) score += 160;
  else if (tokenMatchesField(fields.brand, phrase)) score += 120;

  if (fields.headline === phrase) score += 200;
  else if (fields.headline.startsWith(phrase)) score += 160;
  else if (tokenMatchesField(fields.headline, phrase)) score += 130;

  if (fields.product === phrase) score += 180;
  else if (fields.product.startsWith(phrase)) score += 140;
  else if (tokenMatchesField(fields.product, phrase)) score += 110;

  if (fields.category === phrase) score += 110;
  else if (tokenMatchesField(fields.category, phrase)) score += 80;

  if (fields.labels && tokenMatchesField(fields.labels, phrase)) score += 60;

  for (const token of tokens) {
    const inHeadline = tokenMatchesField(fields.headline, token);
    const inBrand = tokenMatchesField(fields.brand, token);
    const inProduct = tokenMatchesField(fields.product, token);
    const inDestination = tokenMatchesField(fields.destination, token);
    const inCategory = tokenMatchesField(fields.category, token);
    const inLabels = tokenMatchesField(fields.labels, token);
    const inBodyProminent = isProminentInBody(fields.body, token, phrase);
    const inBody = tokenMatchesField(fields.body, token);
    const inDesc = tokenMatchesField(fields.description, token);

    const strong = inHeadline || inBrand || inProduct || inDestination || inCategory || inLabels;
    const any = strong || inBodyProminent || inBody || inDesc;

    if (any) matchedTokens += 1;
    if (strong || inBodyProminent) strongTokenMatches += 1;

    if (inHeadline) score += 55;
    if (inBrand) score += 50;
    if (inProduct) score += 45;
    if (inDestination) score += 40;
    if (inCategory) score += 35;
    if (inLabels) score += 25;
    if (inBodyProminent) score += 75;
    else if (inBody) score += 10;
    if (inDesc) score += 5;
  }

  // Multiword queries require all tokens to match across searchable fields
  const coverage = matchedTokens / tokens.length;
  if (tokens.length > 1 && coverage < 1) return 0;

  // Single-token queries require at least one strong field match or prominent opening body text
  if (strongTokenMatches === 0 && !isProminentInBody(fields.body, tokens[0], phrase)) return 0;

  // Tested relevance threshold: single-word and multi-word must achieve minimum confidence
  return score >= 60 ? score : 0;
}

export function rankRelevantAds(ads: NormalizedAd[], query?: string) {
  const safeAds = ads.filter(isContentSafeForDiscover);
  if (!query?.trim()) return safeAds;

  return safeAds
    .map(ad => ({ ad, score: calculateSearchRelevance(ad, query) }))
    .filter(result => result.score > 0)
    .sort((a, b) => (
      b.score - a.score ||
      (b.ad.intelligence?.winnerScore || 0) - (a.ad.intelligence?.winnerScore || 0) ||
      (b.ad.delivery?.daysRunning || 0) - (a.ad.delivery?.daysRunning || 0)
    ))
    .map(result => result.ad);
}
