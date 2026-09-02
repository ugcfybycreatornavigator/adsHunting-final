import { SavedAdsView } from "@/components/saved-ads-view";
import { requireUser } from "@/lib/auth";
import { ensureDefaultSwipeFile } from "@/lib/swipe-files";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Saved Ads" };

export default async function SavedPage() {
  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return redirect("/login");

  const defaultFileId = await ensureDefaultSwipeFile(supabase, userId);

  return (
    <>
      <PageHeader 
        eyebrow="Creative library" 
        title="Saved Ads" 
        description="Review and organize your saved creative references."
      />
      <div className="mt-8">
        <SavedAdsView collectionId={defaultFileId} />
      </div>
    </>
  );
}
