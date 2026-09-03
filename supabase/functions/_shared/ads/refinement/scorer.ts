/**
 * Quality scorer for ads
 */
import type { RefinedAd } from "../types.ts";

export function calculateQualityScore(ad: Partial<RefinedAd>): number {
  let score = 0;
  
  // Advertiser info
  if (ad.advertiser?.name) score += 15;
  if (ad.advertiser?.logoUrl) score += 10;
  
  // Copy info
  if (ad.copy?.primaryText) score += 20;
  else if (ad.copy?.headline) score += 10;
  
  // Creative
  if (ad.creative?.imageUrl || ad.creative?.videoUrl || (ad.creative?.carouselItems && ad.creative.carouselItems.length > 0)) {
    score += 30;
  }
  
  // Destination
  if (ad.destination?.url) score += 15;
  
  // Intelligence
  if (ad.intelligence?.category) score += 5;
  if (ad.intelligence?.creativeFormat) score += 5;
  
  return Math.min(100, score);
}
