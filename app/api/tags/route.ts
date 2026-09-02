import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const { data, error } = await auth.supabase!.from("tags").select("*").eq("user_id", auth.user!.id).order("name");
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ tags: data ?? [] });
}
export async function POST(request: NextRequest) {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const parsed = z.object({ savedAdId: z.string().uuid(), name: z.string().trim().min(1).max(40) }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a tag up to 40 characters." }, { status: 400 });
  const { data: owned } = await auth.supabase!.from("saved_ads").select("id").eq("id", parsed.data.savedAdId).eq("user_id", auth.user!.id).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Saved ad not found." }, { status: 404 });
  const { data: tag, error: tagError } = await auth.supabase!.from("tags").upsert({ user_id: auth.user!.id, name: parsed.data.name }, { onConflict: "user_id,name" }).select().single();
  if (tagError) return NextResponse.json({ error: tagError.message }, { status: 400 });
  const { error } = await auth.supabase!.from("saved_ad_tags").upsert({ saved_ad_id: parsed.data.savedAdId, tag_id: tag.id });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ tag }, { status: 201 });
}
export async function DELETE(request: NextRequest) {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const params = new URL(request.url).searchParams; const savedAdId = params.get("savedAdId"); const tagId = params.get("tagId");
  if (!savedAdId || !tagId) return NextResponse.json({ error: "Saved ad and tag are required." }, { status: 400 });
  const { error } = await auth.supabase!.from("saved_ad_tags").delete().eq("saved_ad_id", savedAdId).eq("tag_id", tagId);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
