"use client";
import { apiFetch } from "@/lib/api-client";

import useSWR from "swr";
import type { SwipeFile } from "@/lib/types";

export function useSwipeFiles(initialData?: SwipeFile[]) {
  const { data, error, isLoading, mutate } = useSWR<SwipeFile[]>(
    "/api/swipe-files",
    async (url) => {
      const res = await apiFetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to fetch swipe files");
      }
      const fetchedData = await res.json();
      return Array.isArray(fetchedData) 
        ? fetchedData.filter((collection: SwipeFile) => !collection.isSystem)
        : [];
    },
    {
      fallbackData: initialData,
      dedupingInterval: 30000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
    }
  );

  return { 
    data: data || initialData || [], 
    isLoading: !data && !initialData && isLoading, 
    error: error instanceof Error ? error.message : null, 
    mutate 
  };
}
