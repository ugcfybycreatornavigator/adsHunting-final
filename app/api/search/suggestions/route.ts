import { NextRequest, NextResponse } from "next/server";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { requireUser } from "@/lib/auth";
import { rankSuggestions, type SearchSuggestion } from "@/lib/search-suggestions";
import { NICHES, CONTENT_STYLES, LANGUAGES, MARKETS } from "@/lib/taxonomy";
export type { SearchSuggestion } from "@/lib/search-suggestions";

// Read-only catalogue metadata. No provider or usage RPC belongs in autocomplete.
export async function GET(request: NextRequest) {
  const started = performance.now(), requestId = crypto.randomUUID();
  const respond = (body: unknown, status = 200, dbMs = 0) => NextResponse.json(body, {
    status, headers: {
      "Cache-Control": "private, no-store", "X-Request-Id": requestId,
      "Server-Timing": `db;dur=${dbMs.toFixed(1)}, total;dur=${(performance.now() - started).toFixed(1)}`,
    },
  });
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (query.length > 160) return respond({ error: "Search is too long." }, 400);
  if (query.length === 1) return respond({ suggestions: [] });
  const dbStart = performance.now();
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await auth.supabase!.rpc("get_search_suggestions", {
    search_query: escaped, max_limit: query ? 12 : 40,
  });
  const dbMs = performance.now() - dbStart;
  if (error) return respond({ error: "Brand suggestions are temporarily unavailable.", requestId }, 503, dbMs);
  const suggestions: SearchSuggestion[] = (data || []).flatMap((row: { id: string; label: string; advertiser_avatar_url?: string }) => {
    if (!row.id || !row.label?.trim()) return [];
    const imageUrl = /^https?:\/\//i.test(row.advertiser_avatar_url || "") ? row.advertiser_avatar_url : null;
    return [{ id: String(row.id), type: "brand" as const, label: row.label, normalizedLabel: row.label.toLocaleLowerCase(), imageUrl, subtitle: "Indexed in the ad catalogue" }];
  });
  const categories: SearchSuggestion[] = [];
  if (query.length >= 2) {
    for (const source of [{ subtitle: "Niche", data: NICHES }, { subtitle: "Style", data: CONTENT_STYLES }, { subtitle: "Language", data: LANGUAGES }, { subtitle: "Market", data: MARKETS }]) {
      for (const item of source.data) {
        if (item.label.toLowerCase().includes(query.toLowerCase())) categories.push({
          id: `cat_${source.subtitle.toLowerCase()}_${"code" in item ? item.code : item.id}`,
          type: "category", label: item.label, normalizedLabel: item.label.toLowerCase(), subtitle: source.subtitle,
        });
      }
    }
  }
  return respond({ suggestions: query ? [...rankSuggestions(suggestions, query, [], ""), ...categories.slice(0, 3)] : suggestions, requestId }, 200, dbMs);
}
