import "server-only";
import { getServerEnv } from "@/lib/env/server";
import { calculatedMetrics } from "./metrics";
import type { AnalyticsMetrics, AnalyticsPoint, AnalyticsReport, CampaignPerformance, CampaignStatus, DrilldownLevel, DrilldownReport, DrilldownRow, PlatformPerformance } from "./types";

type MetaRow = Record<string, string | undefined> & { actions?: Array<{ action_type: string; value: string }> };
type MetaResponse = { data?: MetaRow[]; paging?: { next?: string }; error?: { message?: string; code?: number; error_subcode?: number } };

function number(value?: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function metrics(row: MetaRow): AnalyticsMetrics {
  return calculatedMetrics({ spend: number(row.spend), impressions: number(row.impressions), clicks: number(row.clicks), reach: row.reach === undefined ? undefined : number(row.reach) });
}
function status(value?: string): CampaignStatus { return value === "ACTIVE" ? "ACTIVE" : value === "ARCHIVED" ? "ARCHIVED" : "PAUSED"; }

export class MetaAnalyticsError extends Error {
  constructor(message: string, public code: "AUTH" | "PERMISSION" | "RATE_LIMIT" | "API") { super(message); }
}

async function request(path: string, token: string, params: Record<string, string>, signal?: AbortSignal) {
  const version = getServerEnv().metaApiVersion || "v27.0";
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", token);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { cache: "no-store", signal: signal || AbortSignal.timeout(20_000) });
    const body = await response.json() as MetaResponse;
    if (response.ok && !body.error) return body;
    const meta = body.error;
    const code = meta?.code === 190 ? "AUTH" : meta?.code === 10 || meta?.code === 200 ? "PERMISSION" : meta?.code === 4 || meta?.code === 17 || meta?.code === 32 ? "RATE_LIMIT" : "API";
    if ((code === "RATE_LIMIT" || response.status >= 500) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      continue;
    }
    throw new MetaAnalyticsError(meta?.message || `Meta returned HTTP ${response.status}.`, code);
  }
  throw new MetaAnalyticsError("Meta reporting did not respond after retries.", "API");
}

async function allPages(path: string, token: string, params: Record<string, string>) {
  const first = await request(path, token, params);
  const rows = [...(first.data || [])];
  let next = first.paging?.next;
  for (let page = 1; next && page < 20; page++) {
    const response = await fetch(next, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = await response.json() as MetaResponse;
    if (!response.ok || body.error) throw new MetaAnalyticsError(body.error?.message || "Meta pagination failed.", "API");
    rows.push(...(body.data || [])); next = body.paging?.next;
  }
  return rows;
}

export async function discoverAdAccounts(token: string) {
  const rows = await allPages("me/adaccounts", token, { fields: "id,name,currency,timezone_name,account_status", limit: "100" });
  return rows.filter(row => number(row.account_status) === 1).map(row => ({ id: String(row.id || "").replace(/^act_/, ""), name: row.name || "Meta Ad Account", currency: row.currency || "USD", timezone: row.timezone_name || "UTC" }));
}

export async function getMetaReport(input: { token: string; account: { id: string; name: string; currency: string; timezone: string }; since: string; until: string }): Promise<AnalyticsReport> {
  const range = JSON.stringify({ since: input.since, until: input.until });
  const common = { time_range: range, limit: "500" };
  const [accountRows, dailyRows, campaignRows, campaignDailyRows, campaignMetadataRows, platformRows] = await Promise.all([
    allPages(`act_${input.account.id}/insights`, input.token, { ...common, level: "account", fields: "spend,impressions,clicks,ctr,cpc,cpm,reach" }),
    allPages(`act_${input.account.id}/insights`, input.token, { ...common, level: "account", time_increment: "1", fields: "date_start,date_stop,spend,impressions,clicks,ctr,cpc,cpm,reach" }),
    allPages(`act_${input.account.id}/insights`, input.token, { ...common, level: "campaign", fields: "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,date_start,date_stop" }),
    allPages(`act_${input.account.id}/insights`, input.token, { ...common, level: "campaign", time_increment: "1", fields: "campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpc,cpm,reach" }),
    allPages(`act_${input.account.id}/campaigns`, input.token, { fields: "id,name,effective_status", limit: "500" }),
    allPages(`act_${input.account.id}/insights`, input.token, { ...common, level: "account", breakdowns: "publisher_platform", fields: "spend,impressions,clicks,ctr,cpc,cpm,reach" }),
  ]);
  const summary = accountRows[0] ? metrics(accountRows[0]) : calculatedMetrics({ spend: 0, impressions: 0, clicks: 0 });
  const daily: AnalyticsPoint[] = dailyRows.map(row => ({ date: row.date_start || input.since, ...metrics(row) }));
  const platforms: PlatformPerformance[] = platformRows.map(row => ({ platform: row.publisher_platform || "unknown", ...metrics(row) }));
  const campaignStatuses = new Map(campaignMetadataRows.map(row => [row.id, status(row.effective_status)]));
  const campaigns: CampaignPerformance[] = campaignRows.map(row => ({ id: row.campaign_id || "unknown", name: row.campaign_name || "Unnamed campaign", status: campaignStatuses.get(row.campaign_id) || "PAUSED", startDate: row.date_start || input.since, endDate: row.date_stop || input.until, daily: campaignDailyRows.filter(day => day.campaign_id === row.campaign_id).map(day => ({ date: day.date_start || input.since, ...metrics(day) })), platforms: [], ...metrics(row) }));
  return { mode: "live", account: input.account, dateRange: { since: input.since, until: input.until }, generatedAt: new Date().toISOString(), summary, daily, platforms, campaigns, partialWarnings: campaigns.length && !daily.length ? ["Daily trend data is unavailable for this period."] : [] };
}

export async function getMetaDrilldown(input: { token: string; account: { id: string; name: string; currency: string; timezone: string }; since: string; until: string; level: DrilldownLevel; parentId: string }): Promise<DrilldownReport> {
  const range = JSON.stringify({ since: input.since, until: input.until });
  const parentField = input.level === "adset" ? "campaign.id" : "adset.id";
  const fields = input.level === "adset"
    ? "adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,ctr,cpc,cpm,reach"
    : "ad_id,ad_name,adset_id,adset_name,date_start,date_stop,spend,impressions,clicks,ctr,cpc,cpm,reach";
  const params = { time_range: range, level: input.level, filtering: JSON.stringify([{ field: parentField, operator: "EQUAL", value: input.parentId }]), fields, limit: "500" };
  const [totals, daily, metadata] = await Promise.all([
    allPages(`act_${input.account.id}/insights`, input.token, params),
    allPages(`act_${input.account.id}/insights`, input.token, { ...params, time_increment: "1" }),
    allPages(`act_${input.account.id}/${input.level === "adset" ? "adsets" : "ads"}`, input.token, { fields: input.level === "adset" ? "id,name,effective_status,campaign_id" : "id,name,effective_status,adset_id,preview_shareable_link", limit: "500" }),
  ]);
  const idField = input.level === "adset" ? "adset_id" : "ad_id";
  const nameField = input.level === "adset" ? "adset_name" : "ad_name";
  const parentNameField = input.level === "adset" ? "campaign_name" : "adset_name";
  const metadataById = new Map(metadata.map(row => [row.id, row]));
  const rows: DrilldownRow[] = totals.map(row => {
    const id = row[idField] || "unknown";
    const detail = metadataById.get(id);
    return {
      id, name: row[nameField] || detail?.name || `Unnamed ${input.level}`, status: status(detail?.effective_status), level: input.level,
      parentId: input.parentId, parentName: row[parentNameField] || "Parent", startDate: row.date_start || input.since, endDate: row.date_stop || input.until,
      daily: daily.filter(point => point[idField] === id).map(point => ({ date: point.date_start || input.since, ...metrics(point) })),
      previewUrl: input.level === "ad" ? detail?.preview_shareable_link : undefined, ...metrics(row),
    };
  });
  return { mode: "live", level: input.level, account: input.account, dateRange: { since: input.since, until: input.until }, generatedAt: new Date().toISOString(), rows, partialWarnings: [] };
}
