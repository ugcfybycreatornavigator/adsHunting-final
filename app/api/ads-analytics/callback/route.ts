import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/ads-analytics/crypto";
import { discoverAdAccounts } from "@/lib/ads-analytics/meta";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const destination = (status: string) => NextResponse.redirect(new URL(`/analytics?connection=${status}`, url.origin));
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", url.origin));
  const cookieStore = await cookies();
  const contextValue = cookieStore.get("meta_analytics_oauth_state")?.value;
  cookieStore.delete("meta_analytics_oauth_state");
  let context: { state: string; userId: string; workspaceId: string } | null = null;
  try { context = contextValue ? JSON.parse(Buffer.from(contextValue, "base64url").toString("utf8")) : null; } catch { context = null; }
  if (!context || url.searchParams.get("state") !== context.state || context.userId !== userId || context.workspaceId !== (orgId || userId)) return destination("invalid_state");
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) return destination("cancelled");
  const env = getServerEnv();
  if (!env.metaAppId || !env.metaAppSecret || !env.metaAnalyticsEncryptionKey) return destination("not_configured");
  const redirectUri = env.metaAnalyticsRedirectUri || new URL("/api/ads-analytics/callback", url.origin).toString();
  try {
    const exchange = new URL(`https://graph.facebook.com/${env.metaApiVersion || "v27.0"}/oauth/access_token`);
    exchange.searchParams.set("client_id", env.metaAppId); exchange.searchParams.set("client_secret", env.metaAppSecret);
    exchange.searchParams.set("redirect_uri", redirectUri); exchange.searchParams.set("code", code);
    const response = await fetch(exchange, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const result = await response.json() as { access_token?: string; expires_in?: number };
    if (!response.ok || !result.access_token) throw new Error("Meta token exchange failed.");
    const accounts = await discoverAdAccounts(result.access_token);
    if (!accounts.length) return destination("no_accounts");
    const workspaceId = orgId || userId;
    const expiresAt = result.expires_in ? new Date(Date.now() + result.expires_in * 1000).toISOString() : null;
    const rows = accounts.map(account => ({ workspace_id: workspaceId, connected_by_user_id: userId, ad_account_id: account.id, ad_account_name: account.name, currency: account.currency, timezone: account.timezone, encrypted_access_token: encryptToken(result.access_token!), token_expires_at: expiresAt, status: "active", updated_at: new Date().toISOString() }));
    const { error } = await createAdminClient().from("meta_ads_connections").upsert(rows, { onConflict: "workspace_id,ad_account_id" });
    if (error) throw error;
    return destination("success");
  } catch (error) {
    console.error("[Ads Analytics] Meta connection failed:", error instanceof Error ? error.message : "Unknown error");
    return destination("failed");
  }
}
