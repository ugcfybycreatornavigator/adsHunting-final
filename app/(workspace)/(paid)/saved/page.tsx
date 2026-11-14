import { requireUser } from "@/lib/auth";
import { ensureDefaultSwipeFile } from "@/lib/swipe-files";
import { redirect } from "next/navigation";

export const metadata = { title: "Saved Ads" };

export default async function SavedPage() {
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return redirect("/sign-in");

  const defaultFileId = await ensureDefaultSwipeFile(supabase, userId);
  redirect(`/swipe-files/${defaultFileId}`);
}
