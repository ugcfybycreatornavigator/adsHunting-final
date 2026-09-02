import { ProviderError, providerErrorFromStatus } from "@/lib/providers/errors";
import { safeExternalUrl } from "@/lib/utils";

type GoogleRawItem = { title?: string; link?: string; displayLink?: string; snippet?: string; formattedUrl?: string; mime?: string };
type GoogleResponse = {
  items?: GoogleRawItem[];
  searchInformation?: { totalResults?: string; formattedSearchTime?: string };
  queries?: { nextPage?: { startIndex?: number }[] };
  error?: { code?: number; message?: string; status?: string; errors?: { reason?: string; message?: string }[] };
};

export type GoogleSearchResult = { title: string; url: string; displayUrl: string; snippet: string; mimeType: string | null };
export type GoogleSearchResponse = { results: GoogleSearchResult[]; totalResults: number | null; nextCursor: string | null; source: "google_search" };

export class GoogleSearchProvider {
  constructor(private config: { apiKey: string; searchEngineId: string }) {}
  async search(query: string, options: { cursor?: string; country?: string; limit?: number } = {}): Promise<GoogleSearchResponse> {
    const start = options.cursor ? Number(options.cursor) : 1;
    if (!Number.isInteger(start) || start < 1 || start > 91) throw new ProviderError("PROVIDER_BAD_REQUEST", "Invalid Google Search cursor.", 400);
    const params = new URLSearchParams({ key: this.config.apiKey, cx: this.config.searchEngineId, q: query, num: String(Math.min(10, Math.max(1, options.limit ?? 5))), start: String(start), safe: "active" });
    if (options.country && /^[A-Za-z]{2}$/.test(options.country)) params.set("gl", options.country.toLowerCase());
    let response: Response;
    try { response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" }); }
    catch { throw new ProviderError("PROVIDER_UNAVAILABLE", "Google Search request failed before a response was received.", 502); }
    const payload = await response.json().catch(() => ({})) as GoogleResponse;
    if (!response.ok || payload.error) throw providerErrorFromStatus("Google Search", response.status || 502, payload.error?.message);
    const results = (payload.items ?? []).flatMap(item => {
      const url = safeExternalUrl(item.link); if (!url) return [];
      return [{ title: item.title || item.displayLink || url, url, displayUrl: item.displayLink || new URL(url).hostname, snippet: item.snippet || "", mimeType: item.mime || null }];
    });
    const total = Number(payload.searchInformation?.totalResults);
    return { results, totalResults: Number.isFinite(total) ? total : null, nextCursor: payload.queries?.nextPage?.[0]?.startIndex ? String(payload.queries.nextPage[0].startIndex) : null, source: "google_search" };
  }
}
