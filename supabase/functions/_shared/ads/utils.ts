type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  return inputs.flatMap((input): string[] => {
    if (!input) return [];
    if (typeof input === "string" || typeof input === "number") return [String(input)];
    if (Array.isArray(input)) return [cn(...input)];
    return Object.entries(input).filter(([, enabled]) => enabled).map(([className]) => className);
  }).filter(Boolean).join(" ");
}

export function daysBetween(start?: string | null, end?: string | null) {
  if (!start) return null;
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

export function formatDate(value?: string | null) {
  if (!value) return "Not available from data provider";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDuration(days?: number | null) {
  if (days == null) return "Duration unavailable";
  if (days === 0) return "Started today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isTrustedAdMediaUrl(value?: string | null) {
  const url = safeExternalUrl(value); if (!url) return false;
  const parsed = new URL(url); if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fbcdn.net" || host.endsWith(".fbcdn.net") || host === "cdninstagram.com" || host.endsWith(".cdninstagram.com");
}

export function winnerScore(input: { runningDays: number | null; variants: number; repetition: number; active: boolean }) {
  const duration = Math.min(45, Math.max(0, input.runningDays ?? 0) * 0.5);
  const variants = Math.min(25, input.variants * 5);
  const repetition = Math.min(20, input.repetition * 4);
  const active = input.active ? 10 : 0;
  return Math.round(Math.min(100, duration + variants + repetition + active));
}

export function intelligenceLabels(ad: { runningDays: number | null; variants: number; active: boolean; startDate: string | null }) {
  const labels: string[] = [];
  if ((ad.runningDays ?? 0) >= 90 && ad.active) labels.push("Active 90+ Days");
  else if ((ad.runningDays ?? 0) >= 30 && ad.active) labels.push("Long Runner");
  if (ad.variants > 1) labels.push("Multiple Variations");
  if (ad.startDate && (daysBetween(ad.startDate) ?? 999) <= 7) labels.push("New");
  return labels;
}

export function sanitizeAdCopy(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // If the copy is purely a template placeholder like {{product.name}}, {{hotel.name}}, ${foo}, etc.
  if (/^(?:\{\{[\s\S]*?\}\}|\$\{[\s\S]*?\}|\{%[\s\S]*?%\})$/.test(trimmed)) {
    return null;
  }
  // Strip inline template placeholders if any remain inside longer text
  const cleaned = trimmed.replace(/\{\{[\s\S]*?\}\}|\$\{[\s\S]*?\}|\{%[\s\S]*?%\}/g, "").trim();
  return cleaned || null;
}
