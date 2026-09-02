import { NextRequest, NextResponse } from "next/server";
import { integrationConfig, getServerEnv } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { SearchApiProvider } from "@/lib/providers/searchapi";
import { MetaProvider } from "@/lib/providers/meta";
import { GoogleSearchProvider } from "@/lib/providers/google-search";
import { ForeplayProvider } from "@/lib/providers/foreplay";
import { ProviderError } from "@/lib/providers/errors";
import { isPreviewMode } from "@/lib/preview";
import { getProviderHealth, setProviderHealth, clearProviderCircuit } from "@/lib/providers";

type State = { configured: boolean; connected: boolean | null; error?: string; status?: string };

export async function GET() {
  const config = integrationConfig();
  const metaCircuit = getProviderHealth("meta");
  const searchApiCircuit = getProviderHealth("searchapi");
  const foreplayCircuit = getProviderHealth("foreplay");

  const metaState: State = {
    configured: config.meta,
    connected: ["CONNECTED", "DEGRADED"].includes(metaCircuit.state) ? true : metaCircuit.state === "NOT_CONFIGURED" ? null : false,
    status: metaCircuit.state !== "NOT_CONFIGURED" ? metaCircuit.state : config.meta ? "CONFIGURED" : "NOT_CONFIGURED",
    error: metaCircuit.errorDetail,
  };

  const searchApiState: State = {
    configured: config.searchApi,
    connected: searchApiCircuit.state === "CONNECTED" ? true : searchApiCircuit.state === "NOT_CONFIGURED" ? null : false,
    status: searchApiCircuit.state !== "NOT_CONFIGURED" ? searchApiCircuit.state : config.searchApi ? "CONFIGURED" : "NOT_CONFIGURED",
    error: searchApiCircuit.errorDetail,
  };
  const foreplayState: State = {
    configured: config.foreplay,
    connected: foreplayCircuit.state === "CONNECTED" ? true : foreplayCircuit.state === "NOT_CONFIGURED" ? null : false,
    status: foreplayCircuit.state !== "NOT_CONFIGURED" ? foreplayCircuit.state : config.foreplay ? "CONFIGURED" : "NOT_CONFIGURED",
    error: foreplayCircuit.errorDetail,
  };

  return NextResponse.json({
    supabase: base(config.supabase),
    searchApi: searchApiState,
    meta: metaState,
    foreplay: foreplayState,
    googleSearch: base(config.googleSearch),
    email: { configured: config.supabase, connected: config.supabase ? true : null },
    mediaArchival: { configured: config.mediaArchival, connected: config.mediaArchival },
    storage: base(config.supabase),
    clerk: { configured: true, connected: true, status: "CONNECTED" },
    activeAdsProvider: searchApiCircuit.state === "CONNECTED" ? "searchapi" : metaCircuit.state === "CONNECTED" ? "meta" : foreplayCircuit.state === "CONNECTED" ? "foreplay" : "none",
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

  // Explicit test clears any temporary circuit breaker state
  clearProviderCircuit("meta");
  clearProviderCircuit("searchapi");
  clearProviderCircuit("foreplay");

  const [supabase, storage, searchApi, meta, foreplay, googleSearch] = await Promise.all([
    testSupabase(env, config.supabase),
    testStorage(env, config.supabase),
    testSearchApi(env, config.searchApi),
    testMeta(env, config.meta),
    testForeplay(env, config.foreplay),
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
    searchApi,
    meta,
    foreplay,
    googleSearch,
    email: emailState,
    mediaArchival: { configured: config.mediaArchival, connected: config.mediaArchival },
    storage,
    clerk: { configured: true, connected: true, status: "CONNECTED" },
    activeAdsProvider: searchApi.connected ? "searchapi" : meta.connected ? "meta" : foreplay.connected ? "foreplay" : "none",
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

async function testSearchApi(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.searchApiKeys.length) return base(false);
  try {
    await new SearchApiProvider(env.searchApiKeys).searchAds({ query: "Nike", country: "US", status: "active" });
    setProviderHealth("searchapi", "CONNECTED");
    return { configured: true, connected: true, status: "CONNECTED" };
  } catch (error: unknown) {
    const isAuthErr = error instanceof ProviderError && error.code === "SEARCHAPI_AUTH_ERROR";
    const statusStr = isAuthErr ? "TOKEN_EXPIRED" : "UNAVAILABLE";
    const msg = safeMessage(error, "SearchAPI connection failed.");
    setProviderHealth("searchapi", statusStr, msg);
    return { configured: true, connected: false, status: statusStr, error: msg };
  }
}

async function testMeta(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.metaAccessToken || !env.metaApiVersion) return base(false);
  const provider = new MetaProvider({
    accessToken: env.metaAccessToken,
    apiVersion: env.metaApiVersion,
    defaultCountry: env.metaDefaultCountry,
  });
  try {
    await provider.healthCheck();
  } catch (error: unknown) {
    const isMetaTokenExpired = error instanceof ProviderError && error.code === "META_TOKEN_EXPIRED";
    const isPermission = error instanceof ProviderError && error.code === "META_PERMISSION_ERROR";
    if (isPermission) {
      const msg = "Meta API is connected. This app's direct ads_archive probe is not permitted; other Meta API calls are unaffected.";
      setProviderHealth("meta", "DEGRADED", msg);
      return { configured: true, connected: true, status: "DEGRADED", error: msg };
    }
    const statusStr = isMetaTokenExpired ? "TOKEN_EXPIRED" : "UNAVAILABLE";
    const msg = isMetaTokenExpired
      ? "Error validating access token: Session has expired"
      : safeMessage(error, "Meta API connection failed.");
    setProviderHealth("meta", statusStr, msg);
    return { configured: true, connected: false, status: statusStr, error: msg };
  }

  try {
    await provider.searchAds({ query: "Nike", country: env.metaDefaultCountry || "US", status: "active" });
    setProviderHealth("meta", "CONNECTED");
    return { configured: true, connected: true, status: "CONNECTED" };
  } catch (error: unknown) {
    const isPermission = error instanceof ProviderError && error.code === "META_PERMISSION_ERROR";
    if (isPermission) {
      const msg = "Meta API is connected. This app's direct ads_archive probe is not permitted; other Meta API calls are unaffected.";
      setProviderHealth("meta", "DEGRADED", msg);
      return { configured: true, connected: true, status: "DEGRADED", error: msg };
    }
    const statusStr = "UNAVAILABLE";
    const msg = safeMessage(error, "Meta Ads Library capability test failed.");
    setProviderHealth("meta", statusStr, msg);
    return { configured: true, connected: true, status: "DEGRADED", error: msg };
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

async function testForeplay(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.foreplayApiKey) return base(false);
  try {
    await new ForeplayProvider(env.foreplayApiKey).healthCheck();
    setProviderHealth("foreplay", "CONNECTED");
    return { configured: true, connected: true, status: "CONNECTED" };
  } catch (error: unknown) {
    const isAuth = error instanceof ProviderError && error.code === "FOREPLAY_AUTH_ERROR";
    const isRate = error instanceof ProviderError && ["FOREPLAY_RATE_LIMIT", "FOREPLAY_QUOTA_EXCEEDED"].includes(error.code);
    const status = isAuth ? "AUTH_ERROR" : isRate ? "RATE_LIMITED" : "UNAVAILABLE";
    const message = safeMessage(error, "Foreplay connection failed.");
    setProviderHealth("foreplay", status, message);
    return { configured: true, connected: false, status, error: message };
  }
}

async function testGoogle(env: ReturnType<typeof getServerEnv>, configured: boolean): Promise<State> {
  if (!configured || !env.googleApiKey || !env.googleSearchEngineId) return base(false);
  try {
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
