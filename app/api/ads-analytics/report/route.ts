import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { parseDateRange } from "@/lib/ads-analytics/dates";
import { accessToken, getConnection } from "@/lib/ads-analytics/connections";
import { getMetaReport, MetaAnalyticsError } from "@/lib/ads-analytics/meta";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  try {
    const range = parseDateRange(url.searchParams.get("since"), url.searchParams.get("until"));
    const connectionId = url.searchParams.get("connectionId");
    if (!connectionId) return NextResponse.json({ error: "Select a connected ad account." }, { status: 400 });
    const workspaceId = orgId || userId;
    const connection = await getConnection(workspaceId, connectionId);
    if (!connection) return NextResponse.json({ error: "Ad account connection not found." }, { status: 404 });
    if (connection.status !== "active") return NextResponse.json({ error: "This Meta authorization needs to be renewed.", code: "REAUTHORIZE" }, { status: 401 });
    const report = await getMetaReport({ token: accessToken(connection), account: { id: connection.ad_account_id, name: connection.ad_account_name, currency: connection.currency, timezone: connection.timezone }, since: range.since, until: range.until });
    await createAdminClient().from("meta_ads_connections").update({ last_synced_at: report.generatedAt, status: "active", updated_at: report.generatedAt }).eq("workspace_id", workspaceId).eq("id", connectionId);
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof MetaAnalyticsError) {
      const status = error.code === "RATE_LIMIT" ? 429 : error.code === "AUTH" ? 401 : error.code === "PERMISSION" ? 403 : 502;
      return NextResponse.json({ error: error.code === "AUTH" ? "Meta authorization expired. Reconnect your account." : error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analytics could not be loaded." }, { status: 400 });
  }
}
