import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { dbAdToNormalized } from "@/lib/catalog";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const parsed = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/).safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_AD_ID", message: "Invalid ad ID." }, { status: 400 });
  const { data, error } = await auth.supabase!.from("ads").select("*").or(`id.eq.${parsed.data},external_ad_id.eq.${parsed.data}`).limit(1).maybeSingle();
  if (error) return NextResponse.json({ success: false, code: "DATABASE_ERROR", message: "Unable to load this ad." }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, code: "AD_NOT_FOUND", message: "Ad not found." }, { status: 404 });
  const ad = dbAdToNormalized(data); delete ad.rawData;
  return NextResponse.json({ success: true, ad });
}
