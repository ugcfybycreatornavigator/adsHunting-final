import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  visibility: z.enum(["public", "private"])
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const { id } = await params;
  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid visibility mode" }, { status: 400 });
  }

  const { visibility } = parsed.data;

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
