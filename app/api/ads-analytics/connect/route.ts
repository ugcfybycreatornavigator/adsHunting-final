import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const env = getServerEnv();
  if (!env.metaAppId || !env.metaAppSecret || !env.metaAnalyticsEncryptionKey) {
    return NextResponse.redirect(new URL("/analytics?connection=not_configured", request.url));
  }
  const state = randomBytes(32).toString("base64url");
  const redirectUri = env.metaAnalyticsRedirectUri || new URL("/api/ads-analytics/callback", request.url).toString();
  const context = Buffer.from(JSON.stringify({ state, userId, workspaceId: orgId || userId })).toString("base64url");
  (await cookies()).set("meta_analytics_oauth_state", context, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/ads-analytics/callback", maxAge: 600 });
  const url = new URL(`https://www.facebook.com/${env.metaApiVersion || "v27.0"}/dialog/oauth`);
  url.searchParams.set("client_id", env.metaAppId); url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state); url.searchParams.set("scope", "ads_read"); url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url);
}
