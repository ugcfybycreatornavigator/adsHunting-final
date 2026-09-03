const windows = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.reset <= now) {
    windows.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > max) return { allowed: false, retryAfter: Math.ceil((current.reset - now) / 1000) };
  return { allowed: true, retryAfter: 0 };
}
