import { isSupabaseConfigured } from "@/lib/env";
import { dbAdToNormalized, type DatabaseAdRow } from "@/lib/catalog";
import type { NormalizedAd } from "@/lib/types";
import { requireUser } from "@/lib/auth";
import { ensureDefaultSwipeFile } from "@/lib/swipe-files";
import { signArchivedAdMedia } from "@/lib/media-access";
import { createAdminClient } from "@/lib/supabase/admin";

import { currentUser } from "@clerk/nextjs/server";

type HomeCount = number | null;

export type DashboardData = {
  user: { firstName: string | null; email: string | null; imageUrl: string } | null;
  actions: {
    discoverAds: HomeCount;
    brands: HomeCount;
    savedAds: HomeCount;
    sharedAds: HomeCount;
    competitors: HomeCount;
    savedAdsHref: string;
  };
  topRunning: NormalizedAd[]; trending: NormalizedAd[]; recent: NormalizedAd[]; mostSaved: NormalizedAd[];
  competitors: { name: string; advertiserId: string; activeAds: number }[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const empty: DashboardData = { user: null, actions: { discoverAds: null, brands: null, savedAds: null, sharedAds: null, competitors: null, savedAdsHref: "/swipe-files" }, topRunning: [], trending: [], recent: [], mostSaved: [], competitors: [] };
  if (!isSupabaseConfigured) return empty;

  const auth = await requireUser();
  const clerkUser = await currentUser();
  const user = clerkUser ? { firstName: clerkUser.firstName, email: clerkUser.primaryEmailAddress?.emailAddress || null, imageUrl: clerkUser.imageUrl } : null;
  if (auth.error || !auth.userId || !auth.supabase) return empty;
  const { userId } = auth;
  const now = new Date().toISOString();

  const adminSupabase = createAdminClient();
  const savedAdsFileId = await safeValue("Home.defaultSavedAds", () => ensureDefaultSwipeFile(adminSupabase, userId));
  const savedAdsHref = savedAdsFileId ? `/swipe-files/${savedAdsFileId}` : "/swipe-files";

  const [discoverAds, savedAds, sharedAds, competitorCount, top, recent, catalogue, savedRows, competitorRows] = await Promise.all([
    countRows("Home.discoverAds", () => adminSupabase.from("ads").select("*", { count: "exact", head: true })),
    savedAdsFileId ? countRows("Home.savedAds", () => adminSupabase.from("swipe_file_items").select("*", { count: "exact", head: true }).eq("swipe_file_id", savedAdsFileId)) : Promise.resolve(null),
    countRows("Home.sharedAds", () => adminSupabase.from("shared_ad_links").select("*", { count: "exact", head: true }).eq("owner_user_id", userId).is("revoked_at", null).or(`expires_at.is.null,expires_at.gte.${now}`)),
    countRows("Home.competitors", () => adminSupabase.from("competitors").select("*", { count: "exact", head: true }).eq("user_id", userId)),
    safeData<DatabaseAdRow[]>("Home.topRunning", () => adminSupabase.from("ads").select("*").eq("status", "active").order("running_days", { ascending: false }).limit(5)),
    safeData<DatabaseAdRow[]>("Home.recent", () => adminSupabase.from("ads").select("*").order("start_date", { ascending: false }).limit(5)),
    safeData<DatabaseAdRow[]>("Home.catalogue", () => adminSupabase.from("ads").select("*").eq("status", "active").order("last_seen_at", { ascending: false }).limit(120)),
    savedAdsFileId ? safeData<{ ads: DatabaseAdRow | DatabaseAdRow[] | null }[]>("Home.savedRows", () => adminSupabase.from("swipe_file_items").select("ads(*)").eq("swipe_file_id", savedAdsFileId).order("created_at", { ascending: false }).limit(5)) : Promise.resolve([]),
    safeData<{ advertiser_id: string; advertiser_name: string }[]>("Home.competitorRows", () => adminSupabase.from("competitors").select("advertiser_id,advertiser_name").eq("user_id", userId).limit(12)),
  ]);

  const catalogueAds = catalogue.map(dbAdToNormalized);
  const trending = catalogueAds.sort((a: NormalizedAd, b: NormalizedAd) => ((b.variants || 1) * 10 + (b.intelligence?.winnerScore || 0)) - ((a.variants || 1) * 10 + (a.intelligence?.winnerScore || 0))).slice(0, 5);

  // Batched query to eliminate N+1 competitor counts
  const activeCountsByAdvertiser = new Map<string, number>();
  if (competitorRows.length > 0) {
    const advertiserIds = competitorRows.map(c => c.advertiser_id);
    const { data: countData, error: countError } = await adminSupabase.rpc("get_competitor_active_counts", {
      p_advertiser_ids: advertiserIds
    });

    if (!countError && Array.isArray(countData)) {
      for (const row of countData as Array<{ advertiser_id: string; active_ads: number }>) {
        activeCountsByAdvertiser.set(row.advertiser_id, Number(row.active_ads));
      }
    } else {
      const { data: activeAdRows } = await adminSupabase
        .from("ads")
        .select("advertiser_id")
        .in("advertiser_id", advertiserIds)
        .eq("status", "active")
        .limit(1000);
      if (activeAdRows) {
        for (const row of activeAdRows) {
          if (row.advertiser_id) {
            activeCountsByAdvertiser.set(
              row.advertiser_id,
              (activeCountsByAdvertiser.get(row.advertiser_id) || 0) + 1
            );
          }
        }
      }
    }
  }

  const tracked = competitorRows.map((competitor) => ({
    name: competitor.advertiser_name,
    advertiserId: competitor.advertiser_id,
    activeAds: activeCountsByAdvertiser.get(competitor.advertiser_id) ?? 0,
  }));
  const mostSaved = savedRows.flatMap((row) => row.ads ? [dbAdToNormalized(Array.isArray(row.ads) ? row.ads[0] : row.ads)] : []);

  const signedAds = await signArchivedAdMedia([
    ...top.map(dbAdToNormalized),
    ...trending,
    ...recent.map(dbAdToNormalized),
    ...mostSaved,
  ]);
  let signedIndex = 0;
  const takeSigned = (length: number) => {
    const start = signedIndex;
    signedIndex += length;
    return signedAds.slice(start, signedIndex);
  };
  const signedTopRunning = takeSigned(top.length);
  const signedTrending = takeSigned(trending.length);
  const signedRecent = takeSigned(recent.length);
  const signedMostSaved = takeSigned(mostSaved.length);

  return { user, actions: { discoverAds, brands: competitorCount, savedAds, sharedAds, competitors: competitorCount, savedAdsHref }, topRunning: signedTopRunning, trending: signedTrending, recent: signedRecent, mostSaved: signedMostSaved, competitors: tracked };
}

async function countRows(operation: string, query: () => PromiseLike<{ count: number | null; error: { message?: string; code?: string; details?: string; hint?: string } | null }>) {
  const { count, error } = await query();
  if (error) {
    logHomeError(operation, error);
    return null;
  }
  return count ?? 0;
}

async function safeData<T>(operation: string, query: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string; details?: string; hint?: string } | null }>) {
  const { data, error } = await query();
  if (error) {
    logHomeError(operation, error);
    return [] as T extends unknown[] ? T : never;
  }
  return (data ?? []) as T extends unknown[] ? T : never;
}

async function safeValue<T>(operation: string, query: () => Promise<T>) {
  try {
    return await query();
  } catch (error) {
    logHomeError(operation, error);
    return null;
  }
}

function logHomeError(operation: string, error: unknown) {
  const details = error && typeof error === "object" ? error as { message?: string; code?: string; details?: string; hint?: string } : {};
  console.error("[Home]", {
    operation,
    message: details.message,
    code: details.code,
    details: details.details,
    hint: details.hint,
  });
}
