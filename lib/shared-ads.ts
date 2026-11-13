import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Computes a deterministic SHA-256 hex digest for a raw share token.
 */
export function hashShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Looks up a shared ad link by token, supporting both newly hashed high-entropy
 * tokens and backward-compatible legacy plaintext links.
 */
export async function findSharedAdLinkByToken<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  token: string,
  columns: string
): Promise<{ data: T | null; error: Error | null }> {
  if (!token || typeof token !== "string") {
    return { data: null, error: null };
  }

  const hashedToken = hashShareToken(token);

  // 1. Primary lookup: SHA-256 hash
  const { data: hashedLink, error: hashedError } = await supabase
    .from("shared_ad_links")
    .select(columns)
    .eq("token_hash", hashedToken)
    .maybeSingle();

  if (hashedError) {
    return { data: null, error: new Error(hashedError.message) };
  }

  if (hashedLink) {
    return { data: hashedLink as unknown as T, error: null };
  }

  // 2. Backward compatibility fallback: lookup by raw token for legacy links
  // or direct lookup if token is already a 64-character hash
  const { data: legacyLink, error: legacyError } = await supabase
    .from("shared_ad_links")
    .select(columns)
    .eq("token_hash", token)
    .maybeSingle();

  if (legacyError) {
    return { data: null, error: new Error(legacyError.message) };
  }

  return { data: (legacyLink as unknown as T) ?? null, error: null };
}
