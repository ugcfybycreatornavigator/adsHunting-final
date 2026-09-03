import { Activity, Gauge, Layers3, Timer } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import type { AnalyticsData } from "@/lib/analytics";

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const metrics = [["Ads analyzed", data.total, Layers3], ["Active now", data.active, Activity], ["Average longevity", `${data.avgDuration}d`, Timer], ["Active 30+ days", data.longRunners, Gauge]] as const;
  const max = Math.max(1, ...data.launches.map((item) => item.value));
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value, Icon]) => <Card key={label} className="p-5 shadow-none"><Icon size={17} className="text-signal" /><p className="mt-5 text-3xl font-semibold tracking-[-.04em]">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></Card>)}</div>
    {data.total ? <>
      <Card className="mt-5 p-5 shadow-none"><div><h2 className="text-base font-semibold">Creative launch velocity</h2><p className="mt-1 text-xs text-muted">New catalogue creatives by week</p></div><div className="mt-8 flex h-48 items-end gap-2 sm:gap-4">{data.launches.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col justify-end"><p className="mb-2 text-center text-[10px] font-semibold">{item.value}</p><div className="min-h-1 rounded-t bg-signal" style={{ height: `${Math.max(2, item.value / max * 100)}%` }} /><p className="mt-2 truncate text-center text-[9px] text-muted">{item.label}</p></div>)}</div></Card>
      <div className="mt-5 grid gap-4 lg:grid-cols-3"><Distribution title="Media mix" values={data.media} showPercent /><Distribution title="CTA patterns" values={data.ctas} /><Distribution title="Platform mix" values={data.platforms} /></div>
    </> : <div className="mt-5"><EmptyState icon={<Gauge />} title="Analytics need catalogue data" body="Search and save live ads to begin measuring observable creative longevity, launch velocity, and distribution patterns." /></div>}
  </>;
}

function Distribution({ title, values, showPercent = false }: { title: string; values: Record<string, number>; showPercent?: boolean }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return <Card className="p-5 shadow-none"><h2 className="text-sm font-semibold">{title}</h2><div className="mt-5 space-y-4">{entries.slice(0, 6).map(([name, value]) => { const percentage = total ? Math.round(value / total * 100) : 0; return <div key={name}><div className="flex justify-between text-xs"><span className="capitalize text-muted">{name.replaceAll("_", " ")}{showPercent ? " Ads" : ""}</span><span className="font-semibold">{showPercent ? `${percentage}%` : value}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-surface"><div className="h-full rounded-full bg-black" style={{ width: `${percentage}%` }} /></div></div>; })}</div></Card>;
}
