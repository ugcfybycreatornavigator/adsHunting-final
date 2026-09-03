import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCompetitorSummaries } from "@/lib/brand-data";
import { CompetitorDashboard } from "@/components/competitor-dashboard";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const auth = await requireUser();
  
  // Fetch competitors with all sync status fields
  const { data: competitors } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .order("created_at", { ascending: false });
    
  // Resolve data efficiently in bulk
  const brands = await getCompetitorSummaries(competitors || []);

  return (
    <>
      <PageHeader
        eyebrow="Market watch"
        title="Competitors"
        description="Track brands and monitor their creative strategy, launches and long-running ads."
      />
      <div className="mt-8">
        <CompetitorDashboard initialBrands={brands} />
      </div>
    </>
  );
}
