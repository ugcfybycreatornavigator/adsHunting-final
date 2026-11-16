import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { parseDateRange } from "@/lib/ads-analytics/dates";
import { getDemoDrilldown } from "@/lib/ads-analytics/demo";
import { accessToken, getConnection } from "@/lib/ads-analytics/connections";
import { getMetaDrilldown, MetaAnalyticsError } from "@/lib/ads-analytics/meta";
import type { DrilldownLevel } from "@/lib/ads-analytics/types";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const level = url.searchParams.get("level") as DrilldownLevel;
  const parentId = url.searchParams.get("parentId") || "";
  if (!(["adset", "ad"] as string[]).includes(level) || !parentId) return NextResponse.json({ error: "A valid reporting level and parent are required." }, { status: 400 });
  try {
    const range = parseDateRange(url.searchParams.get("since"), url.searchParams.get("until"));
    if (url.searchParams.get("mode") === "demo") return NextResponse.json(getDemoDrilldown({ level, parentId, ...range }), { headers: { "Cache-Control": "private, max-age=60" } });
    const connectionId = url.searchParams.get("connectionId") || "";
    const connection = await getConnection(orgId || userId, connectionId);
    if (!connection) return NextResponse.json({ error: "Ad account connection not found." }, { status: 404 });
    if (connection.status !== "active") return NextResponse.json({ error: "Meta authorization must be renewed.", code: "REAUTHORIZE" }, { status: 401 });
    return NextResponse.json(await getMetaDrilldown({ token: accessToken(connection), account: { id: connection.ad_account_id, name: connection.ad_account_name, currency: connection.currency, timezone: connection.timezone }, level, parentId, ...range }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof MetaAnalyticsError ? error.code === "RATE_LIMIT" ? 429 : error.code === "AUTH" ? 401 : error.code === "PERMISSION" ? 403 : 502 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Drilldown reporting failed." }, { status });
  }
}
