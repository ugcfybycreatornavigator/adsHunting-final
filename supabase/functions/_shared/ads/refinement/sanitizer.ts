/**
 * Sanitizer for ad copy and URLs
 */

export function sanitizeCopy(text: string | null | undefined): string | null {
  if (!text) return null;
  
  let cleaned = text;

  // Replace literal "null" or "undefined" strings
  if (cleaned.toLowerCase().trim() === "null" || cleaned.toLowerCase().trim() === "undefined") {
    return null;
  }

  // Strip basic HTML tags
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');
  
  // Replace common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse duplicate whitespace and newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return cleaned || null;
}

export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'twclid', 'igshid', '_bta_tid', '_bta_c',
      'mc_cid', 'mc_eid'
    ];
    
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    return parsed.toString();
  } catch {
    // If not a valid URL, return null
    return null;
  }
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname;
    // Remove www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return null;
  }
}
