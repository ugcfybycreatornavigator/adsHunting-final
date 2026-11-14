import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  source?: "distributed" | "fallback" | "fail-closed";
  error?: string;
}

export interface RateLimitOptions {
  policy?: "fail-closed" | "fail-open";
  timeoutMs?: number;
}

const windows = new Map<string, { count: number; reset: number }>();
const MAX_IN_MEMORY_KEYS = 5000;

function pruneExpiredWindows(now: number) {
  if (windows.size > MAX_IN_MEMORY_KEYS) {
    for (const [key, val] of windows.entries()) {
      if (val.reset <= now) {
        windows.delete(key);
      }
    }
    if (windows.size > MAX_IN_MEMORY_KEYS) {
      const keysToDelete = Array.from(windows.keys()).slice(0, 1000);
      for (const k of keysToDelete) windows.delete(k);
    }
  }
}

export function rateLimitSync(key: string, max = 30, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  pruneExpiredWindows(now);

  const current = windows.get(key);
  if (!current || current.reset <= now) {
    windows.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, retryAfter: 0, source: "fallback" };
  }
  current.count += 1;
  if (current.count > max) {
    return { allowed: false, retryAfter: Math.ceil((current.reset - now) / 1000), source: "fallback" };
  }
  return { allowed: true, retryAfter: 0, source: "fallback" };
}

export async function rateLimit(
  key: string,
  max = 30,
  windowMs = 60_000,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  const timeoutMs = options?.timeoutMs ?? 250;
  const policy = options?.policy ?? "fail-open";

  // 1. Attempt authoritative distributed rate limiting via Supabase RPC
  try {
    const admin = createAdminClient();
    if (admin) {
      const timeoutPromise = new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        if (typeof timer.unref === "function") timer.unref();
      });

      const rpcPromise = (async (): Promise<RateLimitResult | null> => {
        try {
          const { data, error } = await admin.rpc("check_rate_limit", {
            p_key: key,
            p_max: max,
            p_window_ms: windowMs,
          });
          if (error || !data) return null;
          const res = data as { allowed: boolean; retryAfter: number };
          return {
            allowed: Boolean(res.allowed),
            retryAfter: Number(res.retryAfter || 0),
            source: "distributed",
          };
        } catch {
          return null;
        }
      })();

      const result = await Promise.race([rpcPromise, timeoutPromise]);
      if (result && typeof result.allowed === "boolean") {
        return result;
      }
    }
  } catch {
    // Non-fatal, proceed to policy evaluation below
  }

  // 2. Failure Policy Enforcement
  if (policy === "fail-closed") {
    // For expensive, scraping, or external provider endpoints, reject execution when
    // authoritative distributed limits cannot be verified across serverless instances.
    return {
      allowed: false,
      retryAfter: 5,
      source: "fail-closed",
      error: "RATE_LIMIT_SERVICE_UNAVAILABLE",
    };
  }

  // 3. Resilient fallback to memory-bounded in-process rate limiting
  return rateLimitSync(key, max, windowMs);
}
