export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDateRange(since?: string | null, until?: string | null, maxDays = 90) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const defaultSince = new Date(today);
  defaultSince.setUTCDate(defaultSince.getUTCDate() - 29);
  const start = since ? new Date(`${since}T00:00:00Z`) : defaultSince;
  const end = until ? new Date(`${until}T00:00:00Z`) : today;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end || end > today) {
    throw new Error("Choose a valid date range that does not extend into the future.");
  }
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > maxDays) throw new Error(`Reporting ranges are limited to ${maxDays} days.`);
  return { since: isoDate(start), until: isoDate(end), days };
}

export function previousRange(since: string, until: string) {
  const start = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return { since: isoDate(previousStart), until: isoDate(previousEnd) };
}
