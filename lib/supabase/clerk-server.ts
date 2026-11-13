import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

export async function createClerkSupabaseServerClient(explicitToken?: string | null) {
  const env = getPublicSupabaseEnv();
  let token: string | null = explicitToken ?? null;

  if (token === undefined || token === null) {
    try {
      const authObj = await auth();
      // Try dedicated Supabase JWT template first
      try {
        token = await authObj.getToken({ template: "supabase" });
      } catch {
        // Fall back to default session token if template is not configured
      }

      if (!token) {
        token = await authObj.getToken().catch(() => null);
      }
    } catch {
      token = null;
    }
  }

  return createSupabaseClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    },
  });
}
