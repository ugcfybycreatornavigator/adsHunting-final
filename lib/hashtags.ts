/**
 * Hashtag extraction & caption normalization helper.
 * Extracts hashtags locally without external API/AI calls.
 */

export function extractHashtags(text?: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_\u0590-\u05ff]+/g);
  if (!matches) return [];
  
  const tags = matches
    .map(tag => tag.slice(1).toLowerCase().trim())
    .filter(tag => tag.length > 0);

  return [...new Set(tags)];
}

export function normalizeCaption(body?: string | null, headline?: string | null): { caption: string | null; hashtags: string[] } {
  const combined = [headline, body].filter(Boolean).join("\n\n");
  const hashtags = extractHashtags(combined);
  return {
    caption: body?.trim() || headline?.trim() || null,
    hashtags,
  };
}
