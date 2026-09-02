"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useSession } from "@clerk/nextjs";
import { getPublicSupabaseEnv } from "@/lib/env";
import { useMemo } from "react";

export function useSupabaseClient() {
  const { session } = useSession();

  const client = useMemo(() => {
    const env = getPublicSupabaseEnv();
    return createBrowserClient(env.url, env.anonKey, {
      accessToken: async () => {
        return (await session?.getToken()) ?? null;
      },
    });
  }, [session]);

  return client;
}

export function createClerkSupabaseClient(token?: string | null) {
  const env = getPublicSupabaseEnv();
  return createBrowserClient(env.url, env.anonKey, {
    accessToken: async () => token ?? null,
  });
}
