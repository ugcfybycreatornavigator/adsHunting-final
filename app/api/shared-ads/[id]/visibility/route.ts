import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const { id } = await params;
  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { visibility } = body;

  if (visibility !== "public" && visibility !== "private") {
    return NextResponse.json({ error: "Invalid visibility mode" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("shared_ad_links")
    .update({ visibility })
    .eq("id", id)
    .eq("owner_user_id", auth.userId);

  if (error) {
    console.error("[SharedAds] PUT visibility failed", {
      message: error?.message,
      code: error?.code,
    });
    return NextResponse.json({ error: "Failed to update visibility." }, { status: 500 });
  }

  return NextResponse.json({ success: true, visibility });
}
