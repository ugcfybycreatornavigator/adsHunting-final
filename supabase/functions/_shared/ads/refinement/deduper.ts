/**
 * Deduplication logic
 */
import type { RefinedAd } from "../types.ts";

export function generateAdFingerprint(ad: Partial<RefinedAd>): string {
  // Try to use external ID first, as it's the most reliable unique identifier
  if (ad.externalId) {
    return `ext_${ad.externalId}`;
  }
  
  // Fallback: advertiser name + primary text snippet + media hash proxy
  const adv = ad.advertiser?.normalizedName || ad.advertiser?.name || "unknown_adv";
  
  const text = ad.copy?.primaryText || ad.copy?.headline || "";
  // Take first 50 chars of text for fingerprinting
  const textSnippet = text.substring(0, 50).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  
  const mediaUrl = ad.creative?.videoUrl || ad.creative?.imageUrl || 
    (ad.creative?.carouselItems?.[0]?.imageUrl) || "no_media";
  
  // Very simplistic hash for edge function
  let hash = 0;
  const str = `${adv}_${textSnippet}_${mediaUrl}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `fp_${Math.abs(hash).toString(16)}`;
}
