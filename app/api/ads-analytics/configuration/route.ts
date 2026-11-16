import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";

export async function GET(request: NextRequest) {
  if (!(await auth()).userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const env = getServerEnv();
  const callback = env.metaAnalyticsRedirectUri || new URL("/api/ads-analytics/callback", request.url).toString();
  const configured = Boolean(env.metaAppId && env.metaAppSecret && env.metaAnalyticsEncryptionKey && env.metaApiVersion && env.metaAnalyticsRedirectUri);
  return NextResponse.json({
    configured,
    status: configured ? "configured" : "administrator_action_required",
    missing: [!env.metaAppId && "META_APP_ID", !env.metaAppSecret && "META_APP_SECRET", !env.metaApiVersion && "META_API_VERSION", !env.metaAnalyticsRedirectUri && "META_ANALYTICS_REDIRECT_URI", !env.metaAnalyticsEncryptionKey && "META_ANALYTICS_ENCRYPTION_KEY"].filter(Boolean),
    callbackUri: callback,
    apiVersion: env.metaApiVersion || null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
