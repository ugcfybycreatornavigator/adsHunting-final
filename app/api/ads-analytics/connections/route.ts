import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listConnections } from "@/lib/ads-analytics/connections";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try { return NextResponse.json({ accounts: await listConnections(orgId || userId) }); }
  catch { return NextResponse.json({ error: "Connected accounts are temporarily unavailable." }, { status: 503 }); }
}
