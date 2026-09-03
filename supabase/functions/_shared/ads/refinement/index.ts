import type { RefinedAd } from "../types.ts";
import { sanitizeCopy, sanitizeUrl, extractDomain } from "./sanitizer.ts";
import { normalizeAdvertiserName } from "./advertiser.ts";
import { normalizeMediaType, validateMediaUrl } from "./media.ts";
import { calculateQualityScore } from "./scorer.ts";
import { generateAdFingerprint } from "./deduper.ts";

export function refineAd(ad: RefinedAd): RefinedAd {
  // Sanitize Advertiser
  if (ad.advertiser) {
    ad.advertiser.normalizedName = normalizeAdvertiserName(ad.advertiser.name);
    ad.advertiser.pageUrl = sanitizeUrl(ad.advertiser.pageUrl);
    ad.advertiser.logoUrl = validateMediaUrl(ad.advertiser.logoUrl);
    if (ad.advertiser.pageUrl && !ad.advertiser.domain) {
      ad.advertiser.domain = extractDomain(ad.advertiser.pageUrl);
    }
  }

  // Sanitize Copy
  if (ad.copy) {
    ad.copy.primaryText = sanitizeCopy(ad.copy.primaryText);
    ad.copy.headline = sanitizeCopy(ad.copy.headline);
    ad.copy.description = sanitizeCopy(ad.copy.description);
    ad.copy.cta = sanitizeCopy(ad.copy.cta);
  }

  // Clean Media
  if (ad.creative) {
    ad.creative.type = normalizeMediaType(ad.creative.type);
    ad.creative.imageUrl = validateMediaUrl(ad.creative.imageUrl);
    ad.creative.videoUrl = validateMediaUrl(ad.creative.videoUrl);
    ad.creative.thumbnailUrl = validateMediaUrl(ad.creative.thumbnailUrl);
    
    if (ad.creative.carouselItems) {
      ad.creative.carouselItems = ad.creative.carouselItems.map(item => ({
        ...item,
        imageUrl: validateMediaUrl(item.imageUrl) || undefined,
        videoUrl: validateMediaUrl(item.videoUrl) || undefined,
        headline: sanitizeCopy(item.headline) || undefined,
        destinationUrl: sanitizeUrl(item.destinationUrl) || undefined,
      }));
    }
  }

  // Clean Destination
  if (ad.destination) {
    const origUrl = ad.destination.url;
    ad.destination.url = sanitizeUrl(origUrl) || origUrl; // Keep original if sanitize fails completely
    ad.destination.resolvedUrl = sanitizeUrl(ad.destination.resolvedUrl);
    ad.destination.domain = extractDomain(ad.destination.url);
    ad.destination.title = sanitizeCopy(ad.destination.title);
  }

  // Deduplication Fingerprint & Score
  const fingerprint = generateAdFingerprint(ad);
  ad.id = fingerprint;

  ad.enrichment.qualityScore = calculateQualityScore(ad);
  
  // Basic display gate check
  if (ad.enrichment.qualityScore < 40 || !ad.externalId) {
    ad.enrichment.status = "failed";
  }

  return ad;
}
