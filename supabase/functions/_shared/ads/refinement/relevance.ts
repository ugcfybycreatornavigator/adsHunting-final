import type { RefinedAd } from "../types.ts";

export function getMinimumRelevanceScore(searchIntent: string): number {
  if (searchIntent === "GENERIC_TEXT") return 4;
  return 0;
}

export function scoreRelevance(ad: RefinedAd, query: string, intent: string): number {
  if (!query) return 100;
  
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  
  // Basic synonyms mapping
  const synonyms: Record<string, string[]> = {
    "shoes": ["shoe", "sneaker", "sneakers", "footwear"],
    "shoe": ["shoes", "sneaker", "sneakers", "footwear"],
    "sneaker": ["shoes", "shoe", "sneakers", "footwear"],
    "sneakers": ["shoes", "shoe", "sneaker", "footwear"],
  };
  
  const expandedTokens = [...tokens];
  for (const t of tokens) {
    if (synonyms[t]) {
      expandedTokens.push(...synonyms[t]);
    }
  }
  const uniqueExpanded = [...new Set(expandedTokens)];

  let score = 0;

  const headline = (ad.copy?.headline || "").toLowerCase();
  const body = (ad.copy?.primaryText || "").toLowerCase();
  const desc = (ad.copy?.description || "").toLowerCase();
  const advertiser = (ad.advertiser?.name || "").toLowerCase();
  const url = (ad.destination?.url || "").toLowerCase();

  // 1. Exact matches
  if (headline.includes(q)) score += 10;
  if (body.includes(q)) score += 7;
  if (desc.includes(q)) score += 6;
  
  // If it's a generic text search, advertiser match is weaker
  if (advertiser.includes(q)) {
    score += intent === "BRAND" ? 15 : 4;
  }
  
  if (url.includes(q.replace(/\s+/g, ""))) score += 4;

  // 2. Token matches
  let headlineTokenMatches = 0;
  let bodyTokenMatches = 0;
  
  for (const token of uniqueExpanded) {
    const isSynonym = !tokens.includes(token);
    const weight = isSynonym ? 1 : 4; // Synonyms are worth less
    const bodyWeight = isSynonym ? 1 : 2;

    if (headline.includes(token)) {
      headlineTokenMatches += weight;
    }
    if (body.includes(token)) {
      bodyTokenMatches += bodyWeight;
    }
    if (desc.includes(token)) {
      bodyTokenMatches += bodyWeight;
    }
  }

  score += Math.min(headlineTokenMatches, 12);
  score += Math.min(bodyTokenMatches, 8);

  // 3. Score ALL DPA/card text
  if (ad.creative?.carouselItems) {
    for (const item of ad.creative.carouselItems) {
      const itemHeadline = (item.headline || "").toLowerCase();
      const itemDesc = (item.description || "").toLowerCase();
      
      if (itemHeadline.includes(q)) score += 8;
      if (itemDesc.includes(q)) score += 6;
      
      for (const token of uniqueExpanded) {
        if (itemHeadline.includes(token)) score += (!tokens.includes(token) ? 1 : 4);
      }
    }
  }

  // 4. Marketplace Demotion
  const isMarketplace = ["amazon", "flipkart", "meesho", "walmart", "ebay"].some(m => advertiser.includes(m) || url.includes(m));
  
  if (isMarketplace) {
    // If it's a marketplace, it MUST have strong direct query evidence in the copy/cards.
    // An exact advertiser match doesn't count as direct query evidence.
    const directEvidence = score - (advertiser.includes(q) ? (intent === "BRAND" ? 15 : 4) : 0);
    if (directEvidence < 4) {
      score -= 50; // Heavy penalty
    }
  }

  return score;
}
