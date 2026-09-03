import { getCompetitorIntelligence } from "@/lib/brand-data";
import { BrandIntelligenceProfile } from "@/components/brand-intelligence-profile";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function BrandPage({params}:{params:Promise<{id:string}>}){
  const { id } = await params;
  const data = await getCompetitorIntelligence(id);
  const auth = await requireUser();
  let tracking = false;
  
  if (auth.user && auth.supabase) {
    const { count } = await auth.supabase.from("competitors").select("*", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("advertiser_id", id);
    tracking = (count ?? 0) > 0;
  }

  return (
    <>
      <Link href="/brands" className="mb-5 inline-flex items-center gap-2 text-[13px] font-semibold text-muted transition hover:text-ink">
        <ArrowLeft size={14}/> All brands
      </Link>
      <BrandIntelligenceProfile data={data} initialTracking={tracking} />
    </>
  );
}
