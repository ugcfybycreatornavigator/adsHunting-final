import { NextRequest, NextResponse } from "next/server";
import { integrationConfig, getServerEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { SpyglassProvider } from "@/lib/providers/spyglass";
import { ProviderError } from "@/lib/providers/errors";
import { isPreviewMode } from "@/lib/preview";
import { getProviderHealth, setProviderHealth, clearProviderCircuit } from "@/lib/providers";

type State = { configured: boolean; connected: boolean | null; error?: string; status?: string };

export async function GET() {
  const config = integrationConfig();
  const spyglassCircuit = getProviderHealth("spyglass");

  const spyglassState: State = {
    configured: config.spyglass,
    connected: ["CONNECTED", "DEGRADED"].includes(spyglassCircuit.state) ? true : spyglassCircuit.state === "NOT_CONFIGURED" ? null : false,
    status: spyglassCircuit.state !== "NOT_CONFIGURED" ? spyglassCircuit.state : config.spyglass ? "CONFIGURED" : "NOT_CONFIGURED",
    error: spyglassCircuit.errorDetail,
  };

  return NextResponse.json({
    supabase: base(config.supabase),
    spyglass: spyglassState,
    googleSearch: base(config.googleSearch),
    email: { configured: config.supabase, connected: config.supabase ? true : null },
    mediaArchival: { configured: config.mediaArchival, connected: config.mediaArchival },
    storage: base(config.supabase),
    clerk: { configured: true, connected: true, status: "CONNECTED" },
    activeAdsProvider: spyglassCircuit.state === "CONNECTED" ? "spyglass" : "none",
  });
}

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured && !isPreviewMode) {
    const auth = await requireUser();
    if (auth.error) return auth.error;
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const limit = rateLimit(`integration-test:${ip}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, code: "RATE_LIMIT", message: "Connection tests are temporarily rate limited." },
      { status: 429 }
    );
  }

  const env = getServerEnv();
  const config = integrationConfig();

  clearProviderCircuit("spyglass");

  const [supabase, storage, spyglass, googleSearch] = await Promise.all([
    testSupabase(env, config.supabase),
    testStorage(env, config.supabase),
    testSpyglass(env, config.spyglass),
    testGoogle(env, config.googleSearch),
  ]);

  const emailState = {
    configured: config.supabase,
    connected: supabase.connected,
    error: supabase.connected
      ? undefined
      : "Supabase Auth handles email/OTP delivery. Enable Custom SMTP in Supabase Dashboard if delivery fails.",
  };

  return NextResponse.json({
    supabase,
    spyglass,
    googleSearch,
    email: emailState,
    mediaArchival: { configured: config.mediaArchival, connected: config.mediaArchival },
    storage,
    clerk: { configured: true, connected: true, status: "CONNECTED" },
    activeAdsProvider: spyglass.connected ? "spyglass" : "none",
  });
}

function base(configured: boolean): State {
  return { configured, connected: null, status: configured ? "CONFIGURED" : "NOT_CONFIGURED" };
}

async function testSupabase(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.supabaseUrl || !env.serviceRoleKey) return base(false);
  try {
    const response = await fetch(`${env.supabaseUrl}/rest/v1/ads?select=id&limit=1`, {
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (response.ok) return { configured: true, connected: true, status: "CONNECTED" };
    return {
      configured: true,
      connected: false,
      status: "UNAVAILABLE",
      error: response.status === 404 ? "Database migration has not been applied." : `Supabase returned HTTP ${response.status}.`,
    };
  } catch {
    return { configured: true, connected: false, status: "UNAVAILABLE", error: "Supabase connection failed before an HTTP response." };
  }
}

async function testSpyglass(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.spyglassApiKey) return base(false);
  try {
    await new SpyglassProvider(env.spyglassApiKey, env.spyglassEnabled).searchAds({ query: "Nike", country: "ALL", status: "all" });
    setProviderHealth("spyglass", "CONNECTED");
    return { configured: true, connected: true, status: "CONNECTED" };
  } catch (error: unknown) {
    const statusStr = error instanceof ProviderError && error.status === 401 ? "TOKEN_EXPIRED" : "UNAVAILABLE";
    const msg = safeMessage(error, "Spyglass connection failed.");
    setProviderHealth("spyglass", statusStr, msg);
    return { configured: true, connected: false, status: statusStr, error: msg };
  }
}

async function testStorage(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.supabaseUrl || !env.serviceRoleKey) return base(false);
  try {
    const response = await fetch(`${env.supabaseUrl}/storage/v1/bucket/ad-creatives`, {
      headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
      signal: AbortSignal.timeout(12_000), cache: "no-store",
    });
    if (response.ok) return { configured: true, connected: true, status: "CONNECTED" };
    return { configured: true, connected: false, status: "UNAVAILABLE", error: response.status === 404 ? "Creative storage bucket is missing." : `Supabase Storage returned HTTP ${response.status}.` };
  } catch {
    return { configured: true, connected: false, status: "UNAVAILABLE", error: "Supabase Storage connection failed before an HTTP response." };
  }
}

async function testGoogle(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.googleApiKey || !env.googleSearchEngineId) return base(false);
  try {
    const { GoogleSearchProvider } = await import("@/lib/providers/google-search");
    await new GoogleSearchProvider({ apiKey: env.googleApiKey, searchEngineId: env.googleSearchEngineId }).search(
      "Nike official website",
      { limit: 1 }
    );
    return { configured: true, connected: true, status: "CONNECTED" };
  } catch (error) {
    return { configured: true, connected: false, status: "UNAVAILABLE", error: safeMessage(error, "Google Search connection failed.") };
  }
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.slice(0, 240) : fallback;
}
