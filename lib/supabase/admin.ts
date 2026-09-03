import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";

export function createAdminClient() {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new Error("Supabase server environment variables are not configured.");
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
