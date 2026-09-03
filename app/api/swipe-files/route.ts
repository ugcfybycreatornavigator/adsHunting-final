import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSwipeFiles } from "@/lib/swipe-files";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";

export async function GET() {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});
  
  const files = await getSwipeFiles(auth.supabase!, auth.userId);
  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

  const { name, description } = await req.json().catch(() => ({}));
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase!
    .from("swipe_files")
    .insert({
      user_id: auth.userId,
      name: name.trim(),
      description: description?.trim() || null
    })
    .select("id, name, description, is_system, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: "A Swipe File with this name already exists." }, { status: 400 });
    return NextResponse.json({ error: "Failed to create Swipe File" }, { status: 500 });
  }

  return NextResponse.json({ 
    id: data.id, 
    collection: {
      id: data.id,
      name: data.name,
      description: data.description,
      isSystem: data.is_system,
      created_at: data.created_at,
      updated_at: data.updated_at,
      adCount: 0
    }
  });
}
