import { createHash } from "node:crypto";
import type { NormalizedAd } from "./types.ts";

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ") // replace all non-alphanumeric with spaces
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    // Strip common tracking params that vary per campaign
    u.searchParams.delete("fbclid");
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_content");
    u.searchParams.delete("utm_term");
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function computeAdFingerprints(ad: NormalizedAd) {
  const normAdvertiser = normalizeText(ad.advertiser?.id || ad.advertiser?.name);
  
  // Create a deterministic media identity
  let mediaIdentity = "";
  if (ad.creative?.videoUrl || ad.creative?.imageUrl) {
    mediaIdentity = normalizeUrl(ad.creative.videoUrl || ad.creative.imageUrl);
  } else if (ad.creative?.carouselItems && ad.creative.carouselItems.length > 0) {
    mediaIdentity = ad.creative.carouselItems.map(item => normalizeUrl(item.imageUrl || item.videoUrl)).join("|");
  } else if (ad.creative?.thumbnailUrl) {
    mediaIdentity = normalizeUrl(ad.creative.thumbnailUrl);
  }

  const normHeadline = normalizeText(ad.copy?.headline);
  const normBody = normalizeText(ad.copy?.primaryText);

  const creativePayload = `${normAdvertiser}::${mediaIdentity}::${normHeadline}::${normBody}`;
  const groupPayload = `${normAdvertiser}::${mediaIdentity}`;

  const creativeFingerprint = sha256(creativePayload);
  return {
    creativeFingerprint,
    creativeGroupId: "group_" + sha256(groupPayload).slice(0, 16),
    canonicalAdId: `canon_${creativeFingerprint.slice(0, 24)}`,
  };
}
