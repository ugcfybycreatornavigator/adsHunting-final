/**
 * Advertiser normalizer
 */

export function normalizeAdvertiserName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  let cleaned = name.trim();
  
  // Basic cleanup: multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  if (cleaned.length === 0) return null;
  
  return cleaned;
}
