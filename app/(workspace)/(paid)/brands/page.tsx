import { Search, Store } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { BrandCard } from "@/components/brand-card";
import { getCompetitorSummaries, type BrandSummary } from "@/lib/brand-data";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Brands" };

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || "";
  const auth = await requireUser();

  // Fetch only the explicit tracked brands for this user
  const { data: competitors } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .order("created_at", { ascending: false });

  // Resolve data efficiently in bulk
  const intelList = await getCompetitorSummaries(competitors || []);

  // Map to the existing BrandSummary format to preserve the UI
  let brands: BrandSummary[] = intelList.map(intel => ({
    id: intel.advertiserId,
    name: intel.brandName,
    avatar: intel.logoUrl,
    platforms: intel.platforms,
    totalUnique: intel.totalAds,
    activeUnique: intel.activeAds,
    previewMedia: intel.latestCreatives.map(c => c.url),
    previewThumbs: intel.latestCreatives.map(c => c.url)
  }));

  // Apply search filter if query exists
  if (query) {
    const qLower = query.toLowerCase();
    brands = brands.filter(b => b.name.toLowerCase().includes(qLower));
  }

  return (
    <>
      <PageHeader
        eyebrow="Advertiser index"
        title="Brands"
        description="Explore advertiser-level creative systems, launch patterns, CTA preferences, and platform distribution."
      />

      <div className="mt-6 max-w-md">
        <form method="GET" action="/brands" className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search brands or advertisers..."
            className="h-11 w-full rounded-lg border border-line pl-10 pr-4 text-sm outline-none focus:border-brand"
          />
        </form>
      </div>

      <div className="mt-8">
        {brands.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {brands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Store />}
            title={query ? "No matching brands found" : "No brands tracked yet"}
            body={
              query
                ? `No advertiser matching "${query}" was found in your tracked brands.`
                : "Search for a brand and start tracking it to build your brand intelligence workspace."
            }
          />
        )}
      </div>
    </>
  );
}
