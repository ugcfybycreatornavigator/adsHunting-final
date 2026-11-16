"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowDown, ArrowUp, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Download, Eye, Facebook, Gauge, Link2, MousePointerClick, RefreshCw, Search, Unplug, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { compareMetric } from "@/lib/ads-analytics/metrics";
import type { AnalyticsMetricKey, AnalyticsReport, CampaignPerformance, ConnectedAnalyticsAccount, DrilldownLevel, DrilldownRow } from "@/lib/ads-analytics/types";

const METRICS: Array<{ key: AnalyticsMetricKey; label: string; icon: typeof Activity; help: string }> = [
  { key: "spend", label: "Total Ad Spend", icon: CircleDollarSign, help: "Amount spent during this period" },
  { key: "impressions", label: "Impressions", icon: Eye, help: "Total times ads were shown" },
  { key: "clicks", label: "Clicks", icon: MousePointerClick, help: "All recorded ad clicks" },
  { key: "ctr", label: "CTR", icon: Activity, help: "Clicks divided by impressions" },
  { key: "cpc", label: "CPC", icon: Gauge, help: "Average spend per click" },
  { key: "cpm", label: "CPM", icon: BarChart3, help: "Spend per 1,000 impressions" },
];
const PRESETS = [{ value: "today", label: "Today", days: 1 }, { value: "yesterday", label: "Yesterday", days: 1 }, { value: "7", label: "Last 7 days", days: 7 }, { value: "30", label: "Last 30 days", days: 30 }, { value: "90", label: "Last 90 days", days: 90 }, { value: "custom", label: "Custom range", days: 0 }];
type SortKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpm";

export function AdsAnalyticsDashboard({ initialReport }: { initialReport: AnalyticsReport }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [report, setReport] = useState(initialReport);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [accounts, setAccounts] = useState<ConnectedAnalyticsAccount[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [preset, setPreset] = useState("30");
  const [since, setSince] = useState(initialReport.dateRange.since);
  const [until, setUntil] = useState(initialReport.dateRange.until);
  const [metric, setMetric] = useState<AnalyticsMetricKey>("spend");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("spend");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [configurationMissing, setConfigurationMissing] = useState<string[]>([]);
  const [selected, setSelected] = useState<CampaignPerformance | null>(null);
  const connectionsLoaded = useRef(false);
  const pendingLiveConnection = useRef(searchParams.get("connection") === "success");
  const activeRequest = useRef<AbortController | null>(null);
  const pageSize = 5;

  const load = useCallback(async (nextMode = mode, nextSince = since, nextUntil = until, nextConnection = connectionId) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true); setError(""); setErrorRetryable(false);
    const endpoint = nextMode === "demo" ? "/api/ads-analytics/demo" : "/api/ads-analytics/report";
    const query = new URLSearchParams({ since: nextSince, until: nextUntil });
    if (nextMode === "live") query.set("connectionId", nextConnection);
    try {
      const response = await fetch(`${endpoint}?${query}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) { setErrorRetryable(response.status === 429 || response.status >= 500); throw new Error(body.error || "Analytics could not be loaded."); }
      setReport(body); setPage(1); setSelected(null);
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Analytics could not be loaded."); }
    finally { if (activeRequest.current === controller) setLoading(false); }
  }, [connectionId, mode, since, until]);

  useEffect(() => {
    if (connectionsLoaded.current) return;
    connectionsLoaded.current = true;
    fetch("/api/ads-analytics/connections").then(async response => response.ok ? response.json() : { accounts: [] }).then(data => {
      setAccounts(data.accounts || []);
      if (data.accounts?.[0]) {
        const id = data.accounts[0].connectionId;
        setConnectionId(id);
        if (pendingLiveConnection.current) void load("live", since, until, id);
      }
    }).catch(() => undefined);
  }, [load, since, until]);

  useEffect(() => {
    fetch("/api/ads-analytics/configuration", { cache: "no-store" }).then(async response => response.ok ? response.json() : null).then(data => setConfigurationMissing(data?.missing || [])).catch(() => undefined);
    return () => activeRequest.current?.abort();
  }, []);

  useEffect(() => {
    const message = searchParams.get("connection");
    if (message === "success") { setMode("live"); router.replace("/analytics"); }
    else if (message) { setError(connectionMessage(message)); setErrorRetryable(message === "failed"); }
  }, [router, searchParams]);

  function applyPreset(value: string) {
    setPreset(value);
    if (value === "custom") return;
    const end = new Date(); end.setUTCHours(0, 0, 0, 0);
    if (value === "yesterday") end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - Number(PRESETS.find(item => item.value === value)?.days || 1) + 1);
    const nextSince = start.toISOString().slice(0, 10), nextUntil = end.toISOString().slice(0, 10);
    setSince(nextSince); setUntil(nextUntil); void load(mode, nextSince, nextUntil);
  }

  async function switchMode(next: "demo" | "live") {
    setMode(next);
    if (next === "live" && !connectionId) return;
    await load(next);
  }

  const campaigns = useMemo(() => report.campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(search.toLowerCase()) && (status === "ALL" || campaign.status === status)
  ).sort((a, b) => (a[sort] - b[sort]) * (direction === "asc" ? 1 : -1)), [direction, report.campaigns, search, sort, status]);
  const pages = Math.max(1, Math.ceil(campaigns.length / pageSize));
  const visible = campaigns.slice((page - 1) * pageSize, page * pageSize);

  function openCampaign(campaign: CampaignPerformance) {
    setSelected(campaign);
    const next = new URLSearchParams(searchParams.toString()); next.set("campaign", campaign.id);
    router.replace(`/analytics?${next}`, { scroll: false });
  }
  function closeCampaign() { setSelected(null); router.replace("/analytics", { scroll: false }); }

  function exportCsv() {
    const headers = ["Data source", "Account", "Account ID", "Campaign ID", "Campaign name", "Status", "Spend", "Currency", "Impressions", "Clicks", "CTR", "CPC", "CPM", "Reach", "Since", "Until"];
    const rows = campaigns.map(campaign => [report.mode === "demo" ? "DEMO DATA" : "LIVE META DATA", report.account.name, report.account.id, campaign.id, campaign.name, campaign.status, campaign.spend.toFixed(2), report.account.currency, campaign.impressions, campaign.clicks, campaign.ctr.toFixed(4), campaign.cpc.toFixed(2), campaign.cpm.toFixed(2), campaign.reach ?? "", report.dateRange.since, report.dateRange.until]);
    const csv = "\uFEFF" + [headers, ...rows].map(row => row.map(value => `"${safeCsvCell(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `ads-analytics-${report.mode}-${report.dateRange.since}-${report.dateRange.until}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function disconnect() {
    if (!connectionId || !window.confirm("Disconnect this Meta ad account from AdsHunting?")) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ads-analytics/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The account could not be disconnected.");
      const remaining = accounts.filter(account => account.connectionId !== connectionId);
      setAccounts(remaining); setConnectionId(remaining[0]?.connectionId || ""); setMode("demo");
      await load("demo");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The account could not be disconnected."); setLoading(false); }
  }

  return <div className="space-y-5">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand">Advertising intelligence</p><h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Ads Analytics</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">Track advertising performance, monitor spending, and understand how your campaigns perform.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Reporting mode" value={mode} onChange={event => void switchMode(event.target.value as "demo" | "live")} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-signal">
          <option value="demo">Demo account</option><option value="live">Connected Meta account</option>
        </select>
        {mode === "live" && <select aria-label="Meta ad account" value={connectionId} onChange={event => { setConnectionId(event.target.value); void load("live", since, until, event.target.value); }} className="h-10 max-w-[220px] rounded-lg border border-line bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-signal"><option value="">Select account</option>{accounts.map(account => <option key={account.connectionId} value={account.connectionId}>{account.name}</option>)}</select>}
        <select aria-label="Date range" value={preset} onChange={event => applyPreset(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-signal">{PRESETS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <Button variant="secondary" onClick={() => void load()} disabled={loading || (mode === "live" && !connectionId)} aria-label="Refresh analytics"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!campaigns.length}><Download size={16}/> Export</Button>
      </div>
    </header>

    {preset === "custom" && <Card className="flex flex-wrap items-end gap-3 p-4 shadow-none"><label className="text-xs font-semibold text-muted">Start date<input type="date" value={since} max={until} onChange={event => setSince(event.target.value)} className="mt-1 block h-10 rounded-lg border border-line px-3 text-sm text-ink"/></label><label className="text-xs font-semibold text-muted">End date<input type="date" value={until} min={since} max={new Date().toISOString().slice(0, 10)} onChange={event => setUntil(event.target.value)} className="mt-1 block h-10 rounded-lg border border-line px-3 text-sm text-ink"/></label><Button variant="signal" onClick={() => void load()}>Apply range</Button></Card>}

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span>{errorRetryable && <Button variant="secondary" onClick={() => void load()}>Try again</Button>}</div>}

    <Card className="flex flex-col gap-4 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><div className={cn("mt-0.5 grid size-9 place-items-center rounded-lg", report.mode === "demo" ? "bg-surface text-muted" : "bg-brand/10 text-brand")}><Facebook size={17}/></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{report.account.name}</h2><Badge tone={report.mode === "demo" ? "neutral" : "brand"}>{report.mode === "demo" ? "Demo Data" : "Live Meta Data"}</Badge></div><p className="mt-1 text-xs leading-5 text-muted">{report.mode === "demo" ? "You're viewing sample performance data. Connect a Meta Ads account to view your actual analytics." : `Account ••••${report.account.id.slice(-4)} · ${report.account.currency} · ${report.account.timezone}`}</p></div></div>
      <div className="flex flex-wrap items-center gap-2">{report.mode === "demo" ? configurationMissing.length ? <span className="max-w-sm text-xs leading-5 text-muted">Meta connection requires administrator setup. Demo analytics remain available.</span> : <a href="/api/ads-analytics/connect" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-semibold text-white hover:bg-signal-dark"><Link2 size={16}/>Connect Meta Account</a> : <><span className="text-xs text-muted">Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt))}</span><Button variant="ghost" onClick={() => void disconnect()} className="min-h-8 px-2 text-xs"><Unplug size={14}/>Disconnect</Button></>}</div>
    </Card>

    {loading ? <LoadingDashboard/> : <>
      <section aria-label="Performance summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{METRICS.map(item => <MetricCard key={item.key} metric={item} report={report}/>)}</section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
        <Card className="min-w-0 p-5 shadow-none"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">Performance Overview</h2><p className="mt-1 text-xs text-muted">Daily results for the selected reporting period</p></div><div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-surface p-1">{METRICS.map(item => <button key={item.key} onClick={() => setMetric(item.key)} className={cn("whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold", metric === item.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>{item.label.replace("Total Ad ", "")}</button>)}</div></div><TrendChart rows={report.daily} metric={metric} currency={report.account.currency}/></Card>
        <Card className="p-5 shadow-none"><h2 className="font-semibold">Performance by platform</h2><p className="mt-1 text-xs text-muted">Spend and engagement across Meta placements</p><div className="mt-6 space-y-5">{report.platforms.length ? report.platforms.map(platform => <PlatformRow key={platform.platform} platform={platform.platform} spend={platform.spend} clicks={platform.clicks} max={Math.max(...report.platforms.map(row => row.spend))} currency={report.account.currency}/>) : <p className="py-16 text-center text-sm text-muted">Platform breakdown unavailable.</p>}</div></Card>
      </div>
      <Card className="overflow-hidden shadow-none"><div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold">Campaign Performance</h2><p className="mt-1 text-xs text-muted">Search, compare, and open campaign-level analytics</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-[210px] flex-1"><Search size={15} className="absolute left-3 top-3 text-muted"/><span className="sr-only">Search campaigns</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search campaigns" className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-signal"/></label><select aria-label="Campaign status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-line bg-white px-3 text-sm"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="ARCHIVED">Archived</option></select></div></div>
        {visible.length ? <><CampaignTable rows={visible} currency={report.account.currency} sort={sort} direction={direction} onSort={key => { setDirection(sort === key && direction === "desc" ? "asc" : "desc"); setSort(key); }} onOpen={openCampaign}/><div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted"><span>{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronLeft size={15}/></button><span>Page {page} of {pages}</span><button aria-label="Next page" disabled={page === pages} onClick={() => setPage(value => value + 1)} className="grid size-8 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronRight size={15}/></button></div></div></> : <div className="p-5"><EmptyState icon={<Search/>} title="No matching campaigns" body="Adjust the search or status filter to see campaign performance."/></div>}
      </Card>
    </>}
    {mode === "live" && !accounts.length && <EmptyState icon={<Unplug/>} title="No ad account connected" body="Connect your Meta Ads account to view real advertising performance." action={<div className="flex flex-wrap justify-center gap-2"><a href="/api/ads-analytics/connect" className="inline-flex min-h-10 items-center rounded-lg bg-signal px-4 text-sm font-semibold text-white">Connect Meta Account</a><Button variant="secondary" onClick={() => void switchMode("demo")}>Explore Demo Analytics</Button></div>}/>} 
    {selected && <CampaignDetail campaign={selected} currency={report.account.currency} mode={report.mode} connectionId={connectionId} onClose={closeCampaign}/>} 
  </div>;
}

function MetricCard({ metric: { key: metricKey, label, icon: Icon, help }, report }: { metric: typeof METRICS[number]; report: AnalyticsReport }) {
  const value = report.summary[metricKey], prior = report.previous?.[metricKey], change = compareMetric(value, prior);
  return <Card className="p-5 shadow-none"><div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-lg bg-surface text-muted"><Icon size={17}/></div>{change === null ? <span className="text-[11px] text-muted">Comparison unavailable</span> : <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", change >= 0 ? "text-brand" : "text-red-600")}>{change >= 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>} {Math.abs(change).toFixed(1)}%</span>}</div><p className="mt-5 text-2xl font-semibold tracking-[-.03em]">{formatMetric(metricKey, value, report.account.currency)}</p><p className="mt-1 text-xs font-semibold text-muted">{label}</p><p className="mt-3 text-[11px] text-muted">{help}</p></Card>;
}

function TrendChart({ rows, metric, currency }: { rows: AnalyticsReport["daily"]; metric: AnalyticsMetricKey; currency: string }) {
  if (!rows.length) return <div className="grid h-64 place-items-center text-sm text-muted">No daily data for this period.</div>;
  const width = 800, height = 250, padding = 30, values = rows.map(row => row[metric]), max = Math.max(...values, 1), min = Math.min(...values, 0), span = Math.max(max - min, 1);
  const points = values.map((value, index) => `${padding + index / Math.max(values.length - 1, 1) * (width - padding * 2)},${height - padding - (value - min) / span * (height - padding * 2)}`).join(" ");
  return <div className="mt-6"><div className="mb-3 flex items-center justify-between text-[11px] text-muted"><span>{formatMetric(metric, min, currency)}</span><span>{formatMetric(metric, max, currency)}</span></div><svg role="img" aria-label={`${metric} trend from ${rows[0].date} to ${rows.at(-1)?.date}`} viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible"><defs><linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".2"/><stop offset="1" stopColor="var(--brand)" stopOpacity="0"/></linearGradient></defs>{[.25,.5,.75].map(value => <line key={value} x1={padding} x2={width-padding} y1={height*value} y2={height*value} stroke="#E5E7EB" strokeDasharray="4 5"/>)}<polygon points={`${padding},${height-padding} ${points} ${width-padding},${height-padding}`} fill="url(#analytics-fill)"/><polyline points={points} fill="none" stroke="#68B32F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{rows.map((row, index) => { const [x,y] = points.split(" ")[index].split(","); return <circle key={row.date} cx={x} cy={y} r="8" fill="transparent"><title>{`${row.date}: ${formatMetric(metric, row[metric], currency)}`}</title></circle>; })}</svg><div className="flex justify-between text-[11px] text-muted"><span>{shortDate(rows[0].date)}</span><span>{shortDate(rows[Math.floor(rows.length/2)].date)}</span><span>{shortDate(rows.at(-1)!.date)}</span></div></div>;
}

function PlatformRow({ platform, spend, clicks, max, currency }: { platform: string; spend: number; clicks: number; max: number; currency: string }) { return <div><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold capitalize">{platform.replaceAll("_", " ")}</span><span className="text-muted">{money(spend, currency)} · {compact(clicks)} clicks</span></div><div className="mt-2 h-2 rounded-full bg-surface"><div className="h-full rounded-full bg-brand" style={{ width: `${spend / Math.max(max, 1) * 100}%` }}/></div></div>; }

function CampaignTable({ rows, currency, sort, direction, onSort, onOpen }: { rows: CampaignPerformance[]; currency: string; sort: SortKey; direction: "asc"|"desc"; onSort: (key: SortKey) => void; onOpen: (row: CampaignPerformance) => void }) {
  const columns: Array<{ key: SortKey; label: string }> = [{key:"spend",label:"Spend"},{key:"impressions",label:"Impressions"},{key:"clicks",label:"Clicks"},{key:"ctr",label:"CTR"},{key:"cpc",label:"CPC"},{key:"cpm",label:"CPM"}];
  return <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-surface/70 text-muted"><tr><th className="px-5 py-3 font-semibold">Campaign</th><th className="px-3 py-3 font-semibold">Delivery</th>{columns.map(column => <th key={column.key} className="px-3 py-3 text-right font-semibold"><button onClick={() => onSort(column.key)} className="inline-flex items-center gap-1 hover:text-ink">{column.label}{sort === column.key && (direction === "desc" ? <ArrowDown size={11}/> : <ArrowUp size={11}/>)}</button></th>)}<th className="px-5 py-3 text-right font-semibold">Reach</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} onClick={() => onOpen(row)} className="cursor-pointer border-t border-line transition hover:bg-surface/60"><td className="max-w-[260px] px-5 py-4"><button title={row.name} className="block max-w-full truncate text-left font-semibold text-ink hover:underline">{row.name}</button><span className="mt-1 block text-[10px] text-muted">{row.startDate} — {row.endDate}</span></td><td className="px-3 py-4"><Status value={row.status}/></td><td className="px-3 py-4 text-right tabular-nums">{money(row.spend,currency)}</td><td className="px-3 py-4 text-right tabular-nums">{compact(row.impressions)}</td><td className="px-3 py-4 text-right tabular-nums">{compact(row.clicks)}</td><td className="px-3 py-4 text-right tabular-nums">{row.ctr.toFixed(2)}%</td><td className="px-3 py-4 text-right tabular-nums">{money(row.cpc,currency)}</td><td className="px-3 py-4 text-right tabular-nums">{money(row.cpm,currency)}</td><td className="px-5 py-4 text-right tabular-nums">{row.reach === undefined ? "—" : compact(row.reach)}</td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{rows.map(row => <button key={row.id} onClick={() => onOpen(row)} className="block w-full p-4 text-left hover:bg-surface"><div className="flex items-start justify-between gap-3"><span className="font-semibold">{row.name}</span><Status value={row.status}/></div><div className="mt-4 grid grid-cols-3 gap-3 text-xs"><SmallMetric label="Spend" value={money(row.spend,currency)}/><SmallMetric label="Clicks" value={compact(row.clicks)}/><SmallMetric label="CTR" value={`${row.ctr.toFixed(2)}%`}/></div></button>)}</div></>;
}

function CampaignDetail({ campaign, currency, mode, connectionId, onClose }: { campaign: CampaignPerformance; currency: string; mode: "demo" | "live"; connectionId: string; onClose: () => void }) {
  const [level, setLevel] = useState<"campaign" | DrilldownLevel>("campaign");
  const [parent, setParent] = useState<{ id: string; name: string }>({ id: campaign.id, name: campaign.name });
  const [rows, setRows] = useState<DrilldownRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", keydown); return () => document.removeEventListener("keydown", keydown);
  }, [onClose]);

  async function openLevel(nextLevel: DrilldownLevel, nextParent: { id: string; name: string }) {
    setDetailLoading(true); setDetailError("");
    const query = new URLSearchParams({ mode, level: nextLevel, parentId: nextParent.id, since: campaign.startDate, until: campaign.endDate });
    if (mode === "live") query.set("connectionId", connectionId);
    try {
      const response = await fetch(`/api/ads-analytics/drilldown?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Detailed reporting could not be loaded.");
      setRows(body.rows || []); setLevel(nextLevel); setParent(nextParent);
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Detailed reporting could not be loaded."); }
    finally { setDetailLoading(false); }
  }

  function exportLevel() {
    const header = ["Data source", "Level", "Account currency", "Parent ID", "Parent name", "ID", "Name", "Status", "Spend", "Impressions", "Clicks", "CTR", "CPC", "CPM", "Reach", "Since", "Until"];
    const data = rows.map(row => [mode === "demo" ? "DEMO DATA" : "LIVE META DATA", row.level, currency, row.parentId, row.parentName, row.id, row.name, row.status, row.spend.toFixed(2), row.impressions, row.clicks, row.ctr.toFixed(4), row.cpc.toFixed(2), row.cpm.toFixed(2), row.reach ?? "", row.startDate, row.endDate]);
    const csv = "\uFEFF" + [header, ...data].map(row => row.map(value => `"${safeCsvCell(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `ads-analytics-${level}-${campaign.startDate}-${campaign.endDate}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={event => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="campaign-title" className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><Badge tone={mode === "demo" ? "neutral" : "brand"}>{mode === "demo" ? "Demo Data" : "Live Meta Data"}</Badge><h2 id="campaign-title" className="mt-3 text-2xl font-semibold tracking-tight">{level === "campaign" ? campaign.name : parent.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted"><Status value={level === "campaign" ? campaign.status : rows[0]?.status || "PAUSED"}/><span>{campaign.startDate} — {campaign.endDate}</span></div></div><button ref={closeRef} aria-label="Close campaign details" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line hover:bg-surface focus:ring-2 focus:ring-signal"><X size={18}/></button></div>
    <nav aria-label="Reporting hierarchy" className="mt-5 flex flex-wrap items-center gap-2 text-xs"><button onClick={() => { setLevel("campaign"); setRows([]); setParent({ id: campaign.id, name: campaign.name }); }} className="font-semibold text-brand hover:underline">Campaign</button>{level !== "campaign" && <><span className="text-muted">/</span><button onClick={() => void openLevel("adset", { id: campaign.id, name: campaign.name })} className="font-semibold text-brand hover:underline">Ad sets</button></>}{level === "ad" && <><span className="text-muted">/</span><span className="font-semibold">Ads</span></>}</nav>
    {level === "campaign" ? <><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">{METRICS.map(item => <Card key={item.key} className="p-4 shadow-none"><p className="text-[11px] text-muted">{item.label}</p><p className="mt-2 text-lg font-semibold">{formatMetric(item.key,campaign[item.key],currency)}</p></Card>)}</div><Card className="mt-5 p-5 shadow-none"><h3 className="font-semibold">Performance trend</h3>{campaign.daily.length ? <TrendChart rows={campaign.daily} metric="spend" currency={currency}/> : <p className="py-16 text-center text-sm text-muted">Daily campaign trend is unavailable.</p>}</Card><div className="mt-5 flex justify-end"><Button variant="secondary" onClick={() => void openLevel("adset", { id: campaign.id, name: campaign.name })}>View ad sets <ChevronRight size={15}/></Button></div></> : <Card className="mt-5 overflow-hidden shadow-none"><div className="flex items-center justify-between border-b border-line p-4"><div><h3 className="font-semibold capitalize">{level === "adset" ? "Ad sets" : "Individual ads"}</h3><p className="mt-1 text-xs text-muted">Actual metrics scoped to {parent.name}</p></div><Button variant="secondary" onClick={exportLevel} disabled={!rows.length}><Download size={14}/>Export</Button></div>{detailLoading ? <div className="space-y-3 p-4"><Skeleton className="h-16"/><Skeleton className="h-16"/><Skeleton className="h-16"/></div> : detailError ? <div role="alert" className="p-5 text-sm text-red-700">{detailError}</div> : rows.length ? <div className="divide-y divide-line">{rows.map(row => <button key={row.id} onClick={() => level === "adset" && void openLevel("ad", { id: row.id, name: row.name })} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 text-left hover:bg-surface"><span className="min-w-0"><span className="block truncate font-semibold">{row.name}</span><span className="mt-1 block font-mono text-[10px] text-muted">{row.id}</span></span><span className="text-right text-xs"><span className="block font-semibold">{money(row.spend,currency)}</span><span className="mt-1 block text-muted">{compact(row.clicks)} clicks · {row.ctr.toFixed(2)}%</span>{row.previewUrl && <a href={row.previewUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="mt-2 block text-brand hover:underline">Open Meta preview</a>}</span></button>)}</div> : <p className="p-10 text-center text-sm text-muted">No {level === "adset" ? "ad sets" : "ads"} reported data for this period.</p>}</Card>}
    <Card className="mt-5 p-5 shadow-none"><h3 className="font-semibold">Reporting identifiers</h3><dl className="mt-4 grid grid-cols-[110px_1fr] gap-3 text-xs"><dt className="text-muted">Campaign ID</dt><dd className="break-all font-mono">{campaign.id}</dd><dt className="text-muted">Reporting level</dt><dd className="capitalize">{level}</dd><dt className="text-muted">Reach</dt><dd>{campaign.reach === undefined ? "Unavailable" : compact(campaign.reach)}</dd></dl></Card></section></div>;
}

function LoadingDashboard() { return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({length:6},(_,i)=><Skeleton key={i} className="h-44"/>)}</div><div className="grid gap-5 xl:grid-cols-3"><Skeleton className="h-96 xl:col-span-2"/><Skeleton className="h-96"/></div><Skeleton className="h-80"/></div>; }
function Status({ value }: { value: string }) { return <span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-semibold", value === "ACTIVE" ? "bg-brand/10 text-brand" : "bg-surface text-muted")}>{value[0]+value.slice(1).toLowerCase()}</span>; }
function SmallMetric({ label, value }: { label:string; value:string }) { return <span><span className="block text-[10px] text-muted">{label}</span><span className="mt-1 block font-semibold">{value}</span></span>; }
function money(value:number,currency:string) { return new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:2}).format(value); }
function compact(value:number) { return new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(value); }
function formatMetric(key:AnalyticsMetricKey,value:number,currency:string) { if(key==="spend"||key==="cpc"||key==="cpm") return money(value,currency); if(key==="ctr") return `${value.toFixed(2)}%`; return compact(value); }
function shortDate(value:string) { return new Intl.DateTimeFormat("en",{month:"short",day:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`)); }
function safeCsvCell(value: unknown) { const text = String(value); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function connectionMessage(value:string) { return ({not_configured:"Meta connection is not configured on this environment.",invalid_state:"The Meta connection request expired. Please try again.",cancelled:"Meta connection was cancelled.",no_accounts:"No active ad accounts were available for this Meta user.",failed:"Meta could not be connected. Check the app configuration and try again."} as Record<string,string>)[value] || "Meta connection could not be completed."; }
