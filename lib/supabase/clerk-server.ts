import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";

export async function createClerkSupabaseServerClient() {
  const env = getPublicSupabaseEnv();
  const authObj = await auth();
  const token = await authObj.getToken();

  return createSupabaseClient(env.url, env.anonKey, {
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    },
  });
}
