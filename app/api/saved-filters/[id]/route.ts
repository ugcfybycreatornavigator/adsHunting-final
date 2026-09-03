import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  filters: z.record(z.unknown()).optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.is_default) {
    await auth.supabase
      .from("user_saved_filters")
      .update({ is_default: false })
      .eq("user_id", auth.userId)
      .eq("is_default", true);
  }

  const { data, error } = await auth.supabase
    .from("user_saved_filters")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", auth.userId) // RLS handles this, but defense in depth
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A filter with this name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID." }, { status: 400 });

  const { error } = await auth.supabase
    .from("user_saved_filters")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId); // RLS handles this

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
