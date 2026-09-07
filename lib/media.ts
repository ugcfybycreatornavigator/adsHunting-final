import type { NormalizedAd, MediaType } from "./types";
import { safeExternalUrl } from "./utils";

export type ResolvedMedia = {
  kind: MediaType;
  imageUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  carouselAssets?: string[];
  cards?: Array<{
    imageUrl?: string;
    videoUrl?: string;
    headline?: string;
    destinationUrl?: string;
  }>;
};

export function isUsableAdMediaUrl(value?: string | null) {
  const url = safeExternalUrl(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("fbcdn.net")) {
      const expiry = parsed.searchParams.get("oe");
      if (expiry && /^[0-9a-f]+$/i.test(expiry)) {
        const expiresAt = Number.parseInt(expiry, 16) * 1_000;
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return null;
      }
    }
    return url;
  } catch {
    return null;
  }
}

export function resolveAdMedia(ad: NormalizedAd): ResolvedMedia {
  const resolvedImageUrl = isUsableAdMediaUrl(ad.creative.imageUrl);
  const resolvedVideoUrl = isUsableAdMediaUrl(ad.creative.videoUrl);
  const resolvedThumbnailUrl = isUsableAdMediaUrl(ad.creative.thumbnailUrl);
  const resolvedCards = (ad.creative.carouselItems || []).map(card => ({
    ...card,
    imageUrl: isUsableAdMediaUrl(card.imageUrl) || undefined,
    videoUrl: isUsableAdMediaUrl(card.videoUrl) || undefined,
    destinationUrl: safeExternalUrl(card.destinationUrl) || undefined,
  })).filter(card => card.imageUrl || card.videoUrl);

  const carouselAssets = resolvedCards
    .map(c => c.videoUrl || c.imageUrl)
    .filter(Boolean) as string[];

  // Determine actual kind based on what we have, prioritizing completeness
  let kind: MediaType = "unknown";
  
  if (resolvedCards.length > 1) {
    kind = "carousel";
  } else if (resolvedVideoUrl) {
    kind = "video";
  } else if (resolvedImageUrl) {
    kind = "image";
  } else if (resolvedThumbnailUrl) {
    kind = "image";
  }

  // Final validation against the original ad type if it was a carousel but only had one valid item
  if (ad.creative.type === "carousel" && carouselAssets.length === 1) {
    // If it was explicitly marked as carousel, keep it as carousel, unless it's genuinely missing
    kind = "carousel";
  } else if (ad.creative.type === "carousel" && carouselAssets.length > 1) {
    // If it was marked carousel and we found multiple assets, use carousel
    kind = "carousel";
  } else if (ad.creative.type === "video" && !resolvedVideoUrl && (resolvedImageUrl || resolvedThumbnailUrl)) {
    // If it was marked video but only has an image, show it as image
    kind = "image";
  }

  if (kind === "unknown" && ad.creative.type !== "unknown") {
    // If we have nothing, but it was marked, we still mark as unknown (unavailable)
    kind = "unknown";
  } else if (kind === "unknown" && carouselAssets.length > 0) {
    kind = "carousel";
  }

  // If we still don't have media, check if ad explicitly marked as having a type
  if (kind === "unknown" && ad.creative.type && ad.creative.type !== "unknown" && (resolvedVideoUrl || resolvedImageUrl || carouselAssets.length)) {
    // Respect the provider's media type classification even if we couldn't extract URLs
    kind = ad.creative.type;
  }

  return {
    kind,
    imageUrl: resolvedImageUrl,
    videoUrl: resolvedVideoUrl,
    thumbnailUrl: resolvedThumbnailUrl,
    carouselAssets,
    cards: resolvedCards
  };
}
