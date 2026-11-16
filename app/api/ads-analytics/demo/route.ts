import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDemoAnalytics } from "@/lib/ads-analytics/demo";
import { isPreviewMode } from "@/lib/preview";

export async function GET(request: NextRequest) {
  if (!isPreviewMode && !(await auth()).userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const url = new URL(request.url);
    return NextResponse.json(getDemoAnalytics(url.searchParams.get("since"), url.searchParams.get("until")), { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid report request." }, { status: 400 });
  }
}
