import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerEnv, isGoogleSearchConfigured } from "@/lib/env/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { GoogleSearchProvider } from "@/lib/providers/google-search";
import { ProviderError } from "@/lib/providers/errors";
import { isPreviewMode } from "@/lib/preview";

const schema = z.object({ query: z.string().trim().min(2).max(160), cursor: z.string().regex(/^\d+$/).optional(), country: z.string().regex(/^[A-Za-z]{2}$/).optional() });
const cache = new Map<string, { expires: number; payload: unknown }>();

export async function POST(request: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  if (isSupabaseConfigured && !isPreviewMode) { const auth = await requireUser(); if (auth.error) return auth.error; }
  if (!isGoogleSearchConfigured) return NextResponse.json({ success: false, code: "GOOGLE_NOT_CONFIGURED", message: "Google Search is not configured." }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const limit = rateLimit(`google:${ip}`, 15); if (!limit.allowed) return NextResponse.json({ success: false, code: "RATE_LIMIT", message: "Too many enrichment requests." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_SEARCH", message: "Enter a valid Google Search query." }, { status: 400 });
  const key = JSON.stringify(parsed.data); const hit = cache.get(key); if (hit && hit.expires > Date.now()) return NextResponse.json(hit.payload, { headers: { "X-Cache": "HIT" } });
  try {
    const env = getServerEnv();
    const payload = await new GoogleSearchProvider({ apiKey: env.googleApiKey!, searchEngineId: env.googleSearchEngineId! }).search(parsed.data.query, parsed.data);
    cache.set(key, { expires: Date.now() + 60 * 60_000, payload }); if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ProviderError) return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, code: "GOOGLE_UNAVAILABLE", message: "Google Search is temporarily unavailable." }, { status: 502 });
  }
}
