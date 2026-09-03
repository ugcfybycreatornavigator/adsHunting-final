import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { NICHES, CONTENT_STYLES, LANGUAGES, MARKETS } from "@/lib/taxonomy";
import { getServerEnv } from "@/lib/env/server";
import { SpyglassProvider } from "@/lib/providers/spyglass";

type UnknownRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const nested = (value as UnknownRecord).text;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

function safeUrl(value: unknown): string | null {
  const t = text(value);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

const externalProviderCache = new Map<string, { timestamp: number; results: SearchSuggestion[] }>();
const CACHE_TTL_MS = 60_000;

export type SearchSuggestion = {
  id: string;
  type: "brand" | "advertiser" | "keyword" | "category" | "recent";
  label: string;
  normalizedLabel: string;
  subtitle?: string;
  imageUrl?: string | null;
  activeAdCount?: number | null;
  totalAdCount?: number | null;
  href?: string;
};

export async function GET(request: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const query = rawQuery.trim();
  
  if (query.length < 2) {
    return NextResponse.json({ query: rawQuery, suggestions: [] });
  }
  
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);
  const suggestions: SearchSuggestion[] = [];

  const staticSources = [
    { type: "category" as const, subtitle: "Niche", data: NICHES },
    { type: "category" as const, subtitle: "Style", data: CONTENT_STYLES },
    { type: "category" as const, subtitle: "Language", data: LANGUAGES },
    { type: "category" as const, subtitle: "Market", data: MARKETS },
  ];

  for (const source of staticSources) {
    for (const item of source.data) {
      if (item.label.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          id: `cat_${source.subtitle.toLowerCase()}_${'code' in item ? item.code : item.id}`,
          type: source.type,
          label: item.label,
          normalizedLabel: item.label.toLowerCase(),
          subtitle: source.subtitle,
        });
      }
    }
  }

  const startTimer = Date.now();
  try {
    const env = getServerEnv();
    const provider = new SpyglassProvider(env.spyglassApiKey, env.spyglassEnabled);
    const cacheKey = query.toLowerCase();
    const now = Date.now();
    let brandResults: SearchSuggestion[] = [];

    const cached = externalProviderCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      brandResults = cached.results;
    } else {
      try {
        if (!provider.isConfigured()) {
          throw new Error("Spyglass is not configured.");
        }

        const searchBody: Record<string, unknown> = {
          mode: "brand_name",
          brandNames: [query],
          type: "BRAND",
          count: limit,
        };

        const searchPayload = await provider["request"]("/brands/search", {
          method: "POST",
          body: JSON.stringify(searchBody),
        });

        const brands = Array.isArray((searchPayload as UnknownRecord).brands) ? ((searchPayload as UnknownRecord).brands as UnknownRecord[]) : [];
        const mapped: SearchSuggestion[] = brands.map((b) => ({
          id: text(b.id) || String(Math.random()),
          type: "brand" as const,
          label: text(b.name) || "Unnamed Brand",
          normalizedLabel: (text(b.name) || "unnamed brand").toLowerCase(),
          subtitle: "Brand",
          imageUrl: safeUrl(b.thumbnailUrl),
          activeAdCount: null,
        }));

        brandResults = mapped;
        externalProviderCache.set(cacheKey, { timestamp: now, results: brandResults });
      } catch (err) {
        console.warn(`[Autocomplete] Spyglass brand search failed for '${query}':`, err);
      }
    }

    for (const b of brandResults) {
      suggestions.push({
        id: b.id,
        type: "brand",
        label: b.label,
        normalizedLabel: b.normalizedLabel,
        subtitle: "Brand",
        imageUrl: b.imageUrl,
        activeAdCount: null,
      });
    }
  } catch (error) {
    console.error("Suggestion fetch exception:", error);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }

  const durationMs = Date.now() - startTimer;
  if (process.env.NODE_ENV === "development") {
    console.log(`[Autocomplete] '${query}' took ${durationMs}ms`);
  }

  const dedupedMap = new Map<string, SearchSuggestion>();
  for (const s of suggestions) {
    const key = s.id || `${s.type}:${s.normalizedLabel}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, s);
    }
  }

  const finalSuggestions = Array.from(dedupedMap.values()).sort((a, b) => {
    if (a.normalizedLabel === query && b.normalizedLabel !== query) return -1;
    if (b.normalizedLabel === query && a.normalizedLabel !== query) return 1;
    const aStartsWith = a.normalizedLabel.startsWith(query.toLowerCase());
    const bStartsWith = b.normalizedLabel.startsWith(query.toLowerCase());
    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;
    if (a.type === 'brand' && b.type !== 'brand') return -1;
    if (b.type === 'brand' && a.type !== 'brand') return 1;
    return 0;
  }).slice(0, limit);

  return NextResponse.json({ query: rawQuery, suggestions: finalSuggestions }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
    }
  });
}
