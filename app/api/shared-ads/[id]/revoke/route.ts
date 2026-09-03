import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const { id } = await params;
  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await auth.supabase
    .from("shared_ad_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", auth.userId);

  if (error) {
    console.error("[SharedAds] Revoke failed", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json({ error: "Failed to revoke shared link." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
