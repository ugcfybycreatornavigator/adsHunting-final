import { AnalyticsView } from "@/components/analytics-view";
import { PageHeader } from "@/components/ui";
import { getAnalytics } from "@/lib/analytics";
export const metadata={title:"Analytics"};
export default async function AnalyticsPage(){return <><PageHeader eyebrow="Observable intelligence" title="Creative Analytics" description="Understand longevity, launch velocity, formats, platforms, and calls to action—without pretending private performance data is public."/><div className="mt-8"><AnalyticsView data={await getAnalytics()}/></div></>}
