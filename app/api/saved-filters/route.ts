import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  filters: z.record(z.unknown()), // Client will send the AdSearchFilters JSON
  is_default: z.boolean().default(false),
});

export async function GET() {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("user_saved_filters")
    .select("id, name, description, filters, is_default, created_at, updated_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // If this is set to default, we might need to unset others, but the unique index handles the constraint.
  // Actually, to make it easy, we should unset others if is_default is true.
  if (parsed.data.is_default) {
    await auth.supabase
      .from("user_saved_filters")
      .update({ is_default: false })
      .eq("user_id", auth.userId)
      .eq("is_default", true);
  }

  const { data, error } = await auth.supabase
    .from("user_saved_filters")
    .insert({
      user_id: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      filters: parsed.data.filters,
      is_default: parsed.data.is_default,
    })
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
