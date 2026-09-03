/**
 * Media validator and normalizer
 */
import type { MediaType } from "../types.ts";

export function normalizeMediaType(type: string | null | undefined): MediaType {
  if (!type) return "unknown";
  
  const normalized = type.toLowerCase().trim();
  if (normalized.includes("video")) return "video";
  if (normalized.includes("carousel") || normalized.includes("album")) return "carousel";
  if (normalized.includes("image") || normalized.includes("photo")) return "image";
  
  return "unknown";
}

export function validateMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    // Basic structural validation
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
