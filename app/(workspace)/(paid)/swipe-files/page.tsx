import { Suspense } from "react";
import { SwipeFilesManager } from "@/components/swipe-files-manager";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSwipeFiles } from "@/lib/swipe-files";
import { redirect } from "next/navigation";

export const metadata = { title: "Swipe Files" };

function SwipeFilesSkeleton() {
  return (
    <div className="grid gap-[14px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col h-[155px] overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm">
          <Skeleton className="h-[72px] w-full rounded-none" />
          <div className="p-[14px] flex flex-col h-full">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-[4px] h-3 w-1/2" />
            <div className="mt-auto pt-[12px] flex justify-between">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

async function SwipeFilesLoader() {
  const { userId, supabase } = await requireUser();
  if (!userId || !supabase) redirect("/login");

  const files = await getSwipeFiles(supabase, userId);
  // Do not show the system folder (Saved Ads) in the user-created folders list, this matches the API logic
  const initialData = files.filter(f => !f.isSystem);

  return <SwipeFilesManager initialData={initialData} />;
}

export default function SwipeFilesPage() {
  return (
    <>
      <PageHeader 
        eyebrow="Creative library" 
        title="Swipe Files" 
        description="Organize saved ads by angle, format, competitor, campaign, or anything your team wants to study."
      />
      <div className="mt-8">
        <Suspense fallback={<SwipeFilesSkeleton />}>
          <SwipeFilesLoader />
        </Suspense>
      </div>
    </>
  );
}
