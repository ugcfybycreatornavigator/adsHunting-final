import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

  const { id } = await params;
  
  const { data: file } = await auth.supabase!
    .from("swipe_files")
    .select("is_system")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();
    
  if (!file) return new NextResponse("Not Found", { status: 404 });
  if (file.is_system) return NextResponse.json({ error: "Cannot delete the default Swipe File" }, { status: 400 });

  const { error } = await auth.supabase!
    .from("swipe_files")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ success: true });
}
