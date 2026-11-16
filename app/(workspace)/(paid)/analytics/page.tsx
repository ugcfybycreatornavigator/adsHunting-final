import { Suspense } from "react";
import { AdsAnalyticsDashboard } from "@/components/ads-analytics-dashboard";
import { getDemoAnalytics } from "@/lib/ads-analytics/demo";

export const metadata = { title: "Ads Analytics" };

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-surface"/>}><AdsAnalyticsDashboard initialReport={getDemoAnalytics()}/></Suspense>;
}
