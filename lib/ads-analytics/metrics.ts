import type { AnalyticsMetrics } from "./types";

export function calculatedMetrics(input: Pick<AnalyticsMetrics, "spend" | "impressions" | "clicks"> & { reach?: number }): AnalyticsMetrics {
  return {
    ...input,
    ctr: input.impressions > 0 ? input.clicks / input.impressions * 100 : 0,
    cpc: input.clicks > 0 ? input.spend / input.clicks : 0,
    cpm: input.impressions > 0 ? input.spend / input.impressions * 1000 : 0,
  };
}

export function sumMetrics(rows: Array<Pick<AnalyticsMetrics, "spend" | "impressions" | "clicks">>, reach?: number): AnalyticsMetrics {
  const total = rows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    impressions: acc.impressions + row.impressions,
    clicks: acc.clicks + row.clicks,
  }), { spend: 0, impressions: 0, clicks: 0 });
  return calculatedMetrics({ ...total, reach });
}

export function compareMetric(current: number, previous?: number) {
  if (previous === undefined || previous === 0) return null;
  return (current - previous) / previous * 100;
}
