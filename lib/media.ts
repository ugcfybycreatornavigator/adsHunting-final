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

export function resolveAdMedia(ad: NormalizedAd): ResolvedMedia {
  // Base check for rawData to handle unmapped but present media in provider payloads
  let resolvedImageUrl = safeExternalUrl(ad.creative.imageUrl);
  let resolvedVideoUrl = safeExternalUrl(ad.creative.videoUrl);
  let resolvedThumbnailUrl = safeExternalUrl(ad.creative.thumbnailUrl);
  let resolvedCards = ad.creative.carouselItems || [];

  if (!resolvedImageUrl || !resolvedVideoUrl || !resolvedThumbnailUrl || resolvedCards.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = ad.rawData as any;
    if (raw) {
      const snap = raw.snapshot || raw;
      const rawMediaType = String(snap.mediaType || snap.media_type || raw.mediaType || raw.media_type || ad.creative.type || "").toLowerCase();
      const rawMediaUrl = snap.mediaUrl || raw.mediaUrl || snap.media_url || raw.media_url;
      const rawMediaLooksVideo = rawMediaType.includes("video");
      const rawMediaLooksImage = rawMediaType.includes("image") || rawMediaType.includes("photo") || rawMediaType.includes("carousel");
      
      const vhd = snap.video_hd_url || raw.video_hd_url || snap.video || raw.video || snap.videoUrl || raw.videoUrl || (snap.videos?.[0]?.video_hd_url) || (snap.videos?.[0]?.video_url);
      const vsd = snap.video_sd_url || raw.video_sd_url || raw.video_url || snap.video_url || (rawMediaLooksVideo ? rawMediaUrl : undefined) || (snap.videos?.[0]?.video_sd_url);
      if (!resolvedVideoUrl) {
        resolvedVideoUrl = safeExternalUrl(vhd || vsd);
      }

      const imgOrig = snap.original_image_url || raw.original_image_url || snap.image || raw.image || snap.imageUrl || raw.imageUrl || snap.image_url || raw.image_url || (rawMediaLooksImage || !rawMediaLooksVideo ? rawMediaUrl : undefined) || (snap.images?.[0]?.original_image_url);
      const imgResized = snap.resized_image_url || raw.resized_image_url || (snap.images?.[0]?.resized_image_url);
      if (!resolvedImageUrl) {
        resolvedImageUrl = safeExternalUrl(imgOrig || imgResized);
      }

      const thumb = snap.video_preview_image_url || raw.video_preview_image_url || snap.thumbnail || raw.thumbnail || snap.thumbnailUrl || raw.thumbnailUrl || snap.thumbnail_url || raw.thumbnail_url || (snap.videos?.[0]?.video_preview_image_url);
      if (!resolvedThumbnailUrl) {
        resolvedThumbnailUrl = safeExternalUrl(thumb || resolvedImageUrl || resolvedVideoUrl);
      }
      
      const cards = snap.cards || raw.cards;
      if (Array.isArray(cards) && cards.length > 0) {
        resolvedCards = cards.map(c => ({
          headline: c.title || c.headline || undefined,
          imageUrl: safeExternalUrl(c.original_image_url || c.resized_image_url || c.image_url || c.image || c.imageUrl || c.mediaUrl) || undefined,
          videoUrl: safeExternalUrl(c.video_hd_url || c.video_sd_url || c.video_url || c.video || c.videoUrl) || undefined,
          destinationUrl: safeExternalUrl(c.link_url || c.destination_url) || undefined
        }));
      }
    }
  }

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
