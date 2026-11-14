import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type AnalyticsData = {
  total: number;
  active: number;
  avgDuration: number;
  longRunners: number;
  media: Record<string, number>;
  ctas: Record<string, number>;
  platforms: Record<string, number>;
  launches: { label: string; value: number }[];
};

export async function getAnalytics(): Promise<AnalyticsData> {
  const empty: AnalyticsData = {
    total: 0,
    active: 0,
    avgDuration: 0,
    longRunners: 0,
    media: {},
    ctas: {},
    platforms: {},
    launches: []
  };

  if (!isSupabaseConfigured) return empty;
  const admin = createAdminClient();

  // 1. Try fast, accurate database aggregation RPC
  try {
    const { data: rpcData, error: rpcError } = await admin.rpc("get_catalog_analytics");
    if (!rpcError && rpcData && typeof rpcData.total === "number") {
      return rpcData as AnalyticsData;
    }
  } catch {
    // Non-fatal, fall back
  }

  // 2. Direct database query fallback
  try {
    const [{ count: totalCount }, { count: activeCount }] = await Promise.all([
      admin.from("ads").select("*", { count: "exact", head: true }),
      admin.from("ads").select("*", { count: "exact", head: true }).eq("status", "active")
    ]);

    // Fetch sample for distributions if RPC not available
    const { data } = await admin
      .from("ads")
      .select("status,running_days,media_type,cta,platforms,start_date")
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = data ?? [];
    const durations = rows.map(r => r.running_days).filter((v): v is number => typeof v === "number");
    const launches = Array.from({ length: 8 }, (_, index) => {
      const start = new Date();
      start.setDate(start.getDate() - (7 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return {
        label: start.toLocaleDateString("en", { month: "short", day: "numeric" }),
        value: rows.filter(r => r.start_date && new Date(r.start_date) >= start && new Date(r.start_date) < end).length
      };
    });

    return {
      total: totalCount ?? rows.length,
      active: activeCount ?? rows.filter(r => r.status === "active").length,
      avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      longRunners: rows.filter(r => (r.running_days || 0) >= 30 && r.status === "active").length,
      media: count(rows.map(r => r.media_type).filter(Boolean) as string[]),
      ctas: count(rows.map(r => r.cta).filter(Boolean) as string[]),
      platforms: count(rows.flatMap(r => r.platforms || []).filter(Boolean)),
      launches
    };
  } catch (err) {
    console.error("[Analytics] Error loading analytics:", err);
    return empty;
  }
}

function count(items: string[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
}
