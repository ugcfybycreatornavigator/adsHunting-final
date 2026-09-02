"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/env";

export function createClient() {
  const env = getPublicSupabaseEnv();
  return createBrowserClient(env.url, env.anonKey);
}
