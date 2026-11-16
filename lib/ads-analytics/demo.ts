import { calculatedMetrics, sumMetrics } from "./metrics";
import { parseDateRange, previousRange } from "./dates";
import type { AnalyticsMetrics, AnalyticsPoint, AnalyticsReport, CampaignPerformance, CampaignStatus, DrilldownLevel, DrilldownReport, DrilldownRow, PlatformPerformance } from "./types";

const ACCOUNT = { id: "demo_act_204865071", name: "Northstar Commerce — Demo", currency: "INR", timezone: "Asia/Kolkata" };
const CAMPAIGNS: Array<{ id: string; name: string; status: CampaignStatus; weight: number }> = [
  { id: "demo_cmp_01", name: "Festive Collection — Prospecting", status: "ACTIVE", weight: 1.28 },
  { id: "demo_cmp_02", name: "Always-on Retargeting", status: "ACTIVE", weight: .82 },
  { id: "demo_cmp_03", name: "New Arrivals — Reels", status: "ACTIVE", weight: 1.04 },
  { id: "demo_cmp_04", name: "Catalogue Sales — Broad", status: "PAUSED", weight: .68 },
  { id: "demo_cmp_05", name: "Brand Awareness — Metro Cities", status: "ACTIVE", weight: .94 },
  { id: "demo_cmp_06", name: "Creator Partnership Launch", status: "PAUSED", weight: .51 },
  { id: "demo_cmp_07", name: "App Install Test", status: "ARCHIVED", weight: .34 },
  { id: "demo_cmp_08", name: "Weekend Offer — Lookalikes", status: "ACTIVE", weight: .73 },
];
const PLATFORMS = ["facebook", "instagram", "messenger", "audience_network"] as const;
const platformWeights = [.42, .48, .06, .04];

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0) / 4294967295;
}

function rawDay(date: string, campaignIndex: number, weight: number) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const season = .9 + Math.sin(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000 / 8) * .11;
  const activity = CAMPAIGNS[campaignIndex].status === "ARCHIVED" ? .24 : CAMPAIGNS[campaignIndex].status === "PAUSED" ? .58 : 1;
  const weekend = day === 0 || day === 6 ? 1.08 : 1;
  const spend = (710 + hash(`${date}:${campaignIndex}:s`) * 560) * weight * season * weekend * activity;
  const cpm = 151 + hash(`${date}:${campaignIndex}:m`) * 75;
  const impressions = Math.round(spend / cpm * 1000);
  const ctr = .0118 + hash(`${date}:${campaignIndex}:c`) * .0126;
  const clicks = Math.round(impressions * ctr);
  return calculatedMetrics({ spend: Math.round(spend * 100) / 100, impressions, clicks, reach: Math.round(impressions * (.69 + hash(`${date}:${campaignIndex}:r`) * .11)) });
}

function dates(since: string, until: string) {
  const result: string[] = [];
  const cursor = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (cursor <= end) { result.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return result;
}

function platformRows(metrics: AnalyticsMetrics, salt: string): PlatformPerformance[] {
  const weights = PLATFORMS.map((platform, index) => Math.max(.01, platformWeights[index] + (hash(`${salt}:${platform}`) - .5) * .04));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  return PLATFORMS.map((platform, index) => {
    const ratio = weights[index] / weightTotal;
    return { platform, ...calculatedMetrics({ spend: metrics.spend * ratio, impressions: Math.round(metrics.impressions * ratio), clicks: Math.round(metrics.clicks * ratio), reach: metrics.reach ? Math.round(metrics.reach * ratio) : undefined }) };
  });
}

function campaignRows(since: string, until: string): CampaignPerformance[] {
  return CAMPAIGNS.map((campaign, index) => {
    const daily: AnalyticsPoint[] = dates(since, until).map(date => ({ date, ...rawDay(date, index, campaign.weight) }));
    const total = sumMetrics(daily, Math.round(daily.reduce((sum, row) => sum + (row.reach || 0), 0) * .74));
    return { ...campaign, ...total, startDate: since, endDate: until, daily, platforms: platformRows(total, `${campaign.id}:${since}:${until}`) };
  });
}

function reportMetrics(since: string, until: string) {
  const campaigns = campaignRows(since, until);
  const daily = dates(since, until).map(date => {
    const rows = campaigns.map(campaign => campaign.daily.find(row => row.date === date)!).filter(Boolean);
    return { date, ...sumMetrics(rows, Math.round(rows.reduce((sum, row) => sum + (row.reach || 0), 0) * .79)) };
  });
  const summary = sumMetrics(daily, Math.round(daily.reduce((sum, row) => sum + (row.reach || 0), 0) * .57));
  return { campaigns, daily, summary, platforms: platformRows(summary, `${since}:${until}`) };
}

export function getDemoAnalytics(since?: string | null, until?: string | null): AnalyticsReport {
  const range = parseDateRange(since, until);
  const current = reportMetrics(range.since, range.until);
  const previous = previousRange(range.since, range.until);
  return {
    mode: "demo", account: ACCOUNT, dateRange: range, generatedAt: new Date().toISOString(),
    ...current, previous: reportMetrics(previous.since, previous.until).summary, partialWarnings: [],
  };
}

function splitPoint(point: AnalyticsPoint, ratio: number, salt: string): AnalyticsPoint {
  const spend = point.spend * ratio;
  const impressions = Math.round(point.impressions * ratio);
  const clicks = Math.round(point.clicks * ratio);
  return { date: point.date, ...calculatedMetrics({ spend, impressions, clicks, reach: point.reach === undefined ? undefined : Math.round(point.reach * ratio * (.92 + hash(salt) * .06)) }) };
}

export function getDemoDrilldown(input: { level: DrilldownLevel; parentId: string; since?: string | null; until?: string | null }): DrilldownReport {
  const report = getDemoAnalytics(input.since, input.until);
  const campaign = report.campaigns.find(row => row.id === input.parentId);
  const adsetParent = input.level === "ad" ? findDemoAdSet(report.campaigns, input.parentId) : null;
  const parent = campaign || adsetParent;
  if (!parent) return { mode: "demo", level: input.level, account: report.account, dateRange: report.dateRange, generatedAt: report.generatedAt, rows: [], partialWarnings: [] };
  const count = input.level === "adset" ? 3 : 4;
  const labels = input.level === "adset" ? ["Broad audience", "Engaged visitors", "High-intent lookalike"] : ["Video — Product story", "Carousel — Benefits", "Static — Offer", "Reels — Creator cut"];
  const rawWeights = Array.from({ length: count }, (_, index) => .6 + hash(`${input.parentId}:${input.level}:${index}`));
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const rows: DrilldownRow[] = rawWeights.map((weight, index) => {
    const ratio = weight / weightTotal;
    const daily = parent.daily.map(point => splitPoint(point, ratio, `${input.parentId}:${index}:${point.date}`));
    return {
      id: `demo_${input.level}_${input.parentId}_${index + 1}`,
      name: labels[index], status: index === count - 1 ? "PAUSED" : "ACTIVE", level: input.level,
      parentId: input.parentId, parentName: parent.name, startDate: report.dateRange.since, endDate: report.dateRange.until,
      daily, ...sumMetrics(daily, Math.round(daily.reduce((sum, point) => sum + (point.reach || 0), 0) * .7)),
    };
  });
  return { mode: "demo", level: input.level, account: report.account, dateRange: report.dateRange, generatedAt: report.generatedAt, rows, partialWarnings: [] };
}

function findDemoAdSet(campaigns: CampaignPerformance[], adSetId: string) {
  for (const campaign of campaigns) {
    const report = getDemoDrilldown({ level: "adset", parentId: campaign.id, since: campaign.startDate, until: campaign.endDate });
    const row = report.rows.find(item => item.id === adSetId);
    if (row) return row;
  }
  return null;
}
