import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { accessToken, getConnection } from "@/lib/ads-analytics/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { connectionId } = await request.json() as { connectionId?: string };
  if (!connectionId) return NextResponse.json({ error: "Connection ID is required." }, { status: 400 });
  const workspaceId = orgId || userId;
  const connection = await getConnection(workspaceId, connectionId);
  if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  try {
    const version = getServerEnv().metaApiVersion || "v27.0";
    await fetch(`https://graph.facebook.com/${version}/me/permissions`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken(connection)}` }, signal: AbortSignal.timeout(10_000) });
  } catch { /* Local disconnection still prevents future access. */ }
  await createAdminClient().from("meta_ads_connections").delete().eq("workspace_id", workspaceId).eq("id", connectionId);
  return NextResponse.json({ disconnected: true });
}
