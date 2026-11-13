import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SavedAdsView } from "@/components/saved-ads-view";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSwipeFile } from "@/lib/swipe-files";

export default async function SwipeFilePage({params}: {params: Promise<{id: string}>}) {
  const { id } = await params;
  let name = "Swipe File";
  let description = "Review and annotate the creative references collected in this folder.";
  const auth = await requireUser();
  if (!auth.error && auth.supabase && auth.userId) {
    const file = await getSwipeFile(auth.supabase, id, auth.userId);
    if (file) {
      name = file.name;
      description = file.description || description;
    }
  }
  return (
    <>
      <Link href="/swipe-files" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} />All Swipe Files
      </Link>
      <PageHeader eyebrow="Swipe File" title={name} description={description} />
      <div className="mt-8"><SavedAdsView collectionId={id} /></div>
    </>
  );
}
