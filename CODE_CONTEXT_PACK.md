# CODE_CONTEXT_PACK.md

> Comprehensive, untruncated source code context, baseline command outputs, and database stored procedures for `adshunting.com` (`adsHunting-final`).

---

## 1. Phase 1 Security, Auth, Billing & Performance Files (Full Contents)

### `app/api/feedback/route.ts`

```typescript
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = orgId || userId;

    const formData = await req.formData();
    const type = formData.get("type") as string;
    const message = formData.get("message") as string;
    const context = formData.get("context") as string;
    const attachment = formData.get("attachment") as File | null;

    if (!type || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    let parsedContext: Record<string, string> = {};
    try {
      if (context) parsedContext = JSON.parse(context);
    } catch {
      // ignore
    }

    const supabase = createAdminClient();
    
    // Create feedback record first to get ID
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("support_feedback")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        type,
        message,
        page_url: parsedContext.page || null,
        request_id: parsedContext.requestId || null,
      })
      .select("id")
      .single();

    if (feedbackError) {
      console.error("Failed to insert feedback", feedbackError);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    const feedbackId = feedbackData.id;

    // Handle attachment upload if exists
    if (attachment) {
      const extension = attachment.name.split('.').pop() || 'bin';
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const path = `${workspaceId}/${feedbackId}/${safeFileName}`;

      const arrayBuffer = await attachment.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(path, buffer, {
          contentType: attachment.type,
          upsert: false
        });

      if (uploadError) {
        console.error("Failed to upload attachment", uploadError);
        // We don't fail the whole request if attachment fails, just update the record
        // But we could log it.
      } else {
        await supabase
          .from("support_feedback")
          .update({ attachment_path: path })
          .eq("id", feedbackId);
      }
    }

    // Submit to Deftform
    try {
      const deftformPayload = new FormData();
      // What kind of feedback is this?
      deftformPayload.append("data[3afafb42-936b-465a-899a-78b7644e5950]", type);
      // Message
      deftformPayload.append("data[49ac865a-1f55-462f-bc30-d43e259198d4]", message);
      // Screenshots
      if (attachment) {
        deftformPayload.append("data[cfaafa70-b4cb-42d1-9edf-5ae052ac3dca]", attachment);
      }

      const deftformRes = await fetch("https://deftform.com/api/v1/forms/mMbYhG/response", {
        method: "POST",
        headers: {
          "Authorization": "Bearer clUG1XlTfveWtNdgDNXwjGUhrIiXLwA71dci3eCQ76c5e684",
          "Accept": "application/json"
        },
        body: deftformPayload
      });

      if (!deftformRes.ok) {
        const errorText = await deftformRes.text();
        console.error("Deftform API error:", deftformRes.status, errorText);
      }
    } catch (e) {
      console.error("Failed to submit to Deftform", e);
    }

    return NextResponse.json({ success: true, id: feedbackId });

  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

```

### `lib/platform-owner.ts`

```typescript
import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const PLATFORM_OWNER_EMAIL = "creatornavigator@gmail.com";

/**
 * Normalizes an email for reliable comparison against the platform owner email.
 */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL.toLowerCase();
}

/**
 * Checks if a given userId belongs to the platform owner.
 * First checks local Supabase profile cache, or checks Clerk user email.
 */
export async function isPlatformOwner(userId?: string | null): Promise<boolean> {
  if (!userId) return false;

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, is_platform_owner, role")
      .or(`id.eq.${userId},clerk_user_id.eq.${userId}`)
      .maybeSingle();

    if (profile) {
      if (profile.is_platform_owner === true || profile.role === "OWNER") {
        return true;
      }
      if (isPlatformOwnerEmail(profile.email)) {
        return true;
      }
    }
  } catch (err) {
    console.error("[isPlatformOwner] Supabase lookup error:", err);
  }

  // Check current Clerk session user if matches userId
  try {
    const user = await currentUser();
    if (user && (user.id === userId || !userId)) {
      const primaryEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || user.emailAddresses[0]?.emailAddress;

      if (isPlatformOwnerEmail(primaryEmail)) {
        return true;
      }
    }
  } catch {
    // Current user context might not be available in background/cron tasks
  }

  return false;
}

/**
 * Platform owner access context
 */
export async function getPlatformAccessContext(userId: string) {
  const isOwner = await isPlatformOwner(userId);
  return {
    isPlatformOwner: isOwner,
    email: PLATFORM_OWNER_EMAIL,
    role: isOwner ? ("OWNER" as const) : ("MEMBER" as const),
    unlimited: isOwner,
    hasPaidAccess: isOwner,
  };
}

/**
 * Self-healing bootstrap: ensures platform owner account has full access and flags set.
 */
export async function ensurePlatformOwner(userId?: string | null): Promise<void> {
  if (!userId) return;

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, is_platform_owner, role")
      .or(`id.eq.${userId},clerk_user_id.eq.${userId}`)
      .maybeSingle();

    if (profile && isPlatformOwnerEmail(profile.email)) {
      // If columns exist, self-heal flags
      if (!profile.is_platform_owner || profile.role !== "OWNER") {
        await supabase
          .from("profiles")
          .update({
            is_platform_owner: true,
            role: "OWNER",
          })
          .eq("id", profile.id);
      }
    }
  } catch {
    // Gracefully handle if columns are missing
  }
}

```

### `lib/env/server.ts`

```typescript
import "server-only";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalSecret = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalVersion = z.preprocess(emptyToUndefined, z.string().regex(/^v\d+\.\d+$/).optional());
const optionalCountry = z.preprocess(emptyToUndefined, z.string().regex(/^[A-Za-z ]{2,56}$|^ALL$/).optional());
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  SEARCH_API_KEY: optionalSecret,
  SEARCH_API_KEYS: optionalSecret,
  SEARCH_API_KEY_1: optionalSecret,
  SEARCH_API_KEY_2: optionalSecret,
  SEARCH_API_KEY_3: optionalSecret,
  SEARCH_API_KEY_4: optionalSecret,
  FOREPLAY_API_KEY: optionalSecret,
  SPYGLASS_API_KEY: optionalSecret,
  SPYGLASS_ENABLED: z.enum(["true", "false"]).default("false"),
  ADS_PROVIDER_PRIORITY: optionalSecret,
  ADS_PROVIDER_ORDER: optionalSecret,
  // Legacy single provider option (kept for backwards compatibility or override)
  ADS_PROVIDER: z.enum(["auto", "searchapi", "meta", "foreplay", "spyglass"]).default("auto"),
  META_APP_ID: optionalSecret,
  META_APP_SECRET: optionalSecret,
  META_AD_LIBRARY_ACCESS_TOKEN: optionalSecret,
  META_AD_LIBRARY_ENABLED: z.enum(["true", "false"]).default("false"),
  META_API_VERSION: optionalVersion,
  META_DEFAULT_COUNTRY: optionalCountry,
  META_API_TIMEOUT_MS: z.string().optional(),
  GOOGLE_API_KEY: optionalSecret,
  GOOGLE_SEARCH_ENGINE_ID: optionalSecret,
  ALLOW_MEDIA_ARCHIVAL: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  serviceRoleKey?: string;
  searchApiKey?: string;
  searchApiKeys: string[];
  foreplayApiKey?: string;
  spyglassApiKey?: string;
  spyglassEnabled: boolean;
  adsProviderOrder: string[];
  adsProvider: "auto" | "searchapi" | "meta" | "foreplay" | "spyglass";
  metaAppId?: string;
  metaAppSecret?: string;
  metaAccessToken?: string;
  metaEnabled: boolean;
  metaApiVersion?: string;
  metaDefaultCountry?: string;
  metaTimeoutMs?: string;
  googleApiKey?: string;
  googleSearchEngineId?: string;
  allowMediaArchival: boolean;
};

export function getServerEnv(): ServerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}.`);
  }
  const env = parsed.data;
  const searchApiKeys = parseSearchApiKeys([
    env.SEARCH_API_KEY,
    env.SEARCH_API_KEYS,
    env.SEARCH_API_KEY_1,
    env.SEARCH_API_KEY_2,
    env.SEARCH_API_KEY_3,
    env.SEARCH_API_KEY_4,
  ]);
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    searchApiKey: searchApiKeys[0],
    searchApiKeys,
    foreplayApiKey: env.FOREPLAY_API_KEY,
    spyglassApiKey: env.SPYGLASS_API_KEY,
    spyglassEnabled: env.SPYGLASS_ENABLED === "true",
    adsProviderOrder: (env.ADS_PROVIDER_PRIORITY || env.ADS_PROVIDER_ORDER || "meta,foreplay,searchapi")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    adsProvider: env.ADS_PROVIDER,
    metaAppId: env.META_APP_ID,
    metaAppSecret: env.META_APP_SECRET,
    metaAccessToken: env.META_AD_LIBRARY_ACCESS_TOKEN,
    metaEnabled: env.META_AD_LIBRARY_ENABLED === "true",
    metaApiVersion: env.META_API_VERSION,
    metaDefaultCountry: normalizeCountry(env.META_DEFAULT_COUNTRY),
    metaTimeoutMs: env.META_API_TIMEOUT_MS,
    googleApiKey: env.GOOGLE_API_KEY,
    googleSearchEngineId: env.GOOGLE_SEARCH_ENGINE_ID,
    allowMediaArchival: env.ALLOW_MEDIA_ARCHIVAL === "true",
  };
}

export function integrationConfig() {
  const env = getServerEnv();
  return {
    supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey && env.serviceRoleKey),
    searchApi: env.searchApiKeys.length > 0,
    foreplay: Boolean(env.foreplayApiKey),
    spyglass: Boolean(env.spyglassApiKey && env.spyglassEnabled),
    meta: Boolean(env.metaAccessToken && env.metaApiVersion && env.metaEnabled),
    googleSearch: Boolean(env.googleApiKey && env.googleSearchEngineId),
    mediaArchival: env.allowMediaArchival,
  };
}

export const isSearchConfigured = parseSearchApiKeys([
  process.env.SEARCH_API_KEY,
  process.env.SEARCH_API_KEYS,
  process.env.SEARCH_API_KEY_1,
  process.env.SEARCH_API_KEY_2,
  process.env.SEARCH_API_KEY_3,
  process.env.SEARCH_API_KEY_4,
]).length > 0;
export const isForeplayConfigured = Boolean(process.env.FOREPLAY_API_KEY);
export const isSpyglassConfigured = Boolean(process.env.SPYGLASS_API_KEY && process.env.SPYGLASS_ENABLED === "true");
export const isMetaConfigured = Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN && process.env.META_API_VERSION);
export const isGoogleSearchConfigured = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
export const isAnyAdsProviderConfigured = isSearchConfigured || isMetaConfigured || isForeplayConfigured || isSpyglassConfigured;

function normalizeCountry(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    india: "IN", "united states": "US", "united kingdom": "GB", canada: "CA",
    australia: "AU", germany: "DE", france: "FR", brazil: "BR",
  };
  if (known[normalized]) return known[normalized];
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase();
  if (normalized === "all") return "ALL";
  throw new Error("META_DEFAULT_COUNTRY must be a supported country name, a two-letter ISO code, or ALL.");
}

function parseSearchApiKeys(values: Array<string | undefined>) {
  return [...new Set(
    values
      .flatMap((value) => value?.split(/[\s,]+/) ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

```

### `lib/auth.ts`

```typescript
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClerkSupabaseServerClient } from "@/lib/supabase/clerk-server";
import { isPreviewMode } from "@/lib/preview";

export async function requireUser() {
  if (isPreviewMode && isSupabaseConfigured) {
    const admin = createAdminClient();
    const previewId = "preview-user";
    await admin.from("profiles").upsert({ id: previewId, clerk_user_id: previewId, email: "preview@localhost" }, { onConflict: "id" });
    return { userId: previewId, user: { id: previewId }, supabase: admin, error: null };
  }
  const authObj = await auth();
  if (!authObj.userId) {
    return {
      userId: null,
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      sessionReplaced: false,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      userId: authObj.userId,
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }),
      sessionReplaced: false,
    };
  }

  // Idempotent profile fallback for local dev / runtime assurance
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", authObj.userId)
    .maybeSingle();

  if (!profile) {
    const user = await currentUser();
    const primaryEmail = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
    await admin.from("profiles").upsert({
      id: authObj.userId,
      clerk_user_id: authObj.userId,
      email: primaryEmail,
      full_name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null,
      avatar_url: user?.imageUrl || null,
      last_login_at: new Date().toISOString(),
    }, { onConflict: "id" });
  }

  // Active Session Enforcement
  const sessionId = authObj.sessionId;
  
  if (sessionId) {
    const { data: activeSessionData } = await admin
      .from("user_active_sessions")
      .select("active_session_id")
      .eq("user_id", authObj.userId)
      .maybeSingle();

    if (!activeSessionData || activeSessionData.active_session_id !== sessionId) {
      // Need to activate this session if it's newer, otherwise reject
      const { verifyAndActivateSession } = await import("./auth-session");
      const activated = await verifyAndActivateSession(authObj.userId, sessionId, admin);
      
      if (!activated) {
        return {
          userId: authObj.userId,
          user: null,
          supabase: null,
          error: NextResponse.json({ error: "This session is no longer active.", code: "SESSION_REPLACED" }, { status: 401 }),
          sessionReplaced: true,
        };
      }
    }
  }

  // Bypass Clerk JWT requirement by returning admin client for now
  // const supabase = await createClerkSupabaseServerClient();
  const supabase = admin;
  return { userId: authObj.userId, user: await currentUser(), supabase, error: null, sessionReplaced: false };
}

```

### `lib/auth-session.ts`

```typescript
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function verifyAndActivateSession(userId: string, sessionId: string, adminClient = createAdminClient()) {
  const clerk = await clerkClient();
  const session = await clerk.sessions.getSession(sessionId);

  if (!session) {
    return false; // Invalid session
  }

  const sessionCreatedAt = new Date(session.createdAt).toISOString();

  // Call the atomic activation function
  const { data: activated, error } = await adminClient.rpc('activate_session_if_newer', {
    p_user_id: userId,
    p_session_id: sessionId,
    p_session_created_at: sessionCreatedAt
  });

  if (error) {
    console.error("Error activating session in DB:", error);
    return false;
  }

  if (activated) {
    // We are the newest! Revoke other sessions via Clerk.
    try {
      const clientAuth = await auth();
      // Alternatively, we can fetch all sessions for the user and revoke them.
      const userSessions = await clerk.sessions.getSessionList({ userId });
      for (const s of userSessions.data) {
        if (s.id !== sessionId && s.status === 'active') {
          await clerk.sessions.revokeSession(s.id);
        }
      }
    } catch (e) {
      console.error("Failed to revoke other sessions:", e);
      // We don't fail the activation if revocation fails, as per instructions.
    }
  }

  return activated;
}

```

### `lib/dashboard.ts`

```typescript
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
  const tracked = await Promise.all(competitorRows.map(async (competitor) => {
    const activeAds = await countRows("Home.competitorActiveAds", () => adminSupabase.from("ads").select("*", { count: "exact", head: true }).eq("advertiser_id", competitor.advertiser_id).eq("status", "active"));
    return { name: competitor.advertiser_name, advertiserId: competitor.advertiser_id, activeAds: activeAds ?? 0 };
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

```

### `lib/analytics.ts`

```typescript
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
export type AnalyticsData={total:number;active:number;avgDuration:number;longRunners:number;media:Record<string,number>;ctas:Record<string,number>;platforms:Record<string,number>;launches:{label:string;value:number}[]};
export async function getAnalytics():Promise<AnalyticsData>{const empty={total:0,active:0,avgDuration:0,longRunners:0,media:{},ctas:{},platforms:{},launches:[]};if(!isSupabaseConfigured)return empty;const supabase=await createClient();const{data}=await supabase.from("ads").select("status,running_days,media_type,cta,platforms,start_date").limit(2000);const rows=data??[];const durations=rows.map(r=>r.running_days).filter((v):v is number=>typeof v==="number");const launches=Array.from({length:8},(_,index)=>{const start=new Date();start.setDate(start.getDate()-(7-index)*7);const end=new Date(start);end.setDate(end.getDate()+7);return{label:start.toLocaleDateString("en",{month:"short",day:"numeric"}),value:rows.filter(r=>r.start_date&&new Date(r.start_date)>=start&&new Date(r.start_date)<end).length};});return{total:rows.length,active:rows.filter(r=>r.status==="active").length,avgDuration:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):0,longRunners:rows.filter(r=>(r.running_days||0)>=30&&r.status==="active").length,media:count(rows.map(r=>r.media_type)),ctas:count(rows.map(r=>r.cta).filter(Boolean) as string[]),platforms:count(rows.flatMap(r=>r.platforms||[])),launches};}
function count(items:string[]){return items.reduce<Record<string,number>>((acc,item)=>{acc[item]=(acc[item]||0)+1;return acc;},{});}

```

### `lib/rate-limit.ts`

```typescript
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

```

### `tests/early-access.test.ts`

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { EARLY_ACCESS, formatPaise, inrAmountToPaise } = createRequire(import.meta.url)(
  "../supabase/functions/_shared/early-access.ts",
) as typeof import("../supabase/functions/_shared/early-access");
const { validateCashfreeEarlyAccessEvidence } = createRequire(import.meta.url)(
  "../supabase/functions/_shared/cashfree.ts",
) as typeof import("../supabase/functions/_shared/cashfree");

const migration = readFileSync("supabase/migrations/20260908000100_early_access_checkout.sql", "utf8");
const createFunction = readFileSync("supabase/functions/billing-create-early-access/index.ts", "utf8");
const verifyFunction = readFileSync("supabase/functions/billing-verify-early-access/index.ts", "utf8");
const webhook = readFileSync("supabase/functions/cashfree-webhook/index.ts", "utf8");
const cashfree = readFileSync("supabase/functions/_shared/cashfree.ts", "utf8");
const checkout = readFileSync("components/billing/EarlyAccessCheckout.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const billingConfig = readFileSync("lib/billing/billing-config.ts", "utf8");
const packageManifest = readFileSync("package.json", "utf8");

test("Early Access price and credit constants are exact and decimal-safe", () => {
  assert.equal(EARLY_ACCESS.basePricePaise, 49_900);
  assert.equal(EARLY_ACCESS.gstPaise, 8_982);
  assert.equal(EARLY_ACCESS.totalPaise, 58_882);
  assert.equal(EARLY_ACCESS.credits, 3_000);
  assert.equal(EARLY_ACCESS.totalAmountInr, "588.82");
  assert.equal(inrAmountToPaise("588.82"), 58_882);
  assert.equal(inrAmountToPaise(588.82), 58_882);
  assert.equal(formatPaise(EARLY_ACCESS.totalPaise), "₹588.82");
});

test("Cashfree order creation uses server constants and mandatory One Click Checkout", () => {
  assert.match(cashfree, /CASHFREE_API_VERSION = "2026-01-01"/);
  assert.match(createFunction, /order_amount:\s*Number\(EARLY_ACCESS\.totalAmountInr\)/);
  assert.doesNotMatch(createFunction, /body\?\.(amount|credits)|body\.(amount|credits)/);
  assert.match(createFunction, /one_click_checkout:\s*\{/);
  assert.match(createFunction, /enabled:\s*true/);
  assert.match(createFunction, /checkoutCollectAddress/);
  assert.match(createFunction, /checkoutAuthenticate/);
  assert.match(createFunction, /payment_session_id/);
  assert.match(createFunction, /x-idempotency-key|createCashfreeOrder\(orderPayload, requestId, paymentId\)/);
});

test("server verification requires authenticated ownership and authoritative Cashfree evidence", () => {
  assert.match(verifyFunction, /verifyClerkToken/);
  assert.match(verifyFunction, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(verifyFunction, /getCashfreeOrder/);
  assert.match(verifyFunction, /getCashfreePaymentsForOrder/);
  assert.match(cashfree, /order\.order_status === "PAID"/);
  assert.match(cashfree, /payment\.payment_status === "SUCCESS"/);
  assert.match(cashfree, /order\.customer_details\?\.customer_id !== expected\.workspaceId/);
  assert.match(cashfree, /amountToPaise\(payment\.payment_amount\) === expected\.amountPaise/);
  assert.match(cashfree, /order\.order_tags\?\.internal_payment_id !== expected\.internalPaymentId/);
});

test("Cashfree evidence maps paid, pending, failed, cancelled, and dropped states without granting early", () => {
  const expected = {
    orderId: "ea_1234567890abcdef1234567890abcdef",
    workspaceId: "user_123",
    internalPaymentId: "11111111-1111-4111-8111-111111111111",
    amountPaise: 58_882,
    currency: "INR",
    paymentType: "early_access",
  };
  const order = {
    cf_order_id: "cashfree-order",
    order_id: expected.orderId,
    order_amount: 588.82,
    order_currency: "INR",
    order_status: "PAID",
    customer_details: { customer_id: expected.workspaceId },
    order_tags: {
      product: expected.paymentType,
      workspace_id: expected.workspaceId,
      internal_payment_id: expected.internalPaymentId,
    },
  };
  const payment = {
    cf_payment_id: 987654,
    order_id: expected.orderId,
    order_amount: 588.82,
    order_currency: "INR",
    payment_amount: 588.82,
    payment_currency: "INR",
    payment_status: "SUCCESS" as const,
    payment_completion_time: "2026-09-08T10:00:00Z",
  };

  assert.deepEqual(validateCashfreeEarlyAccessEvidence(order, [payment], expected, inrAmountToPaise), {
    state: "paid",
    paymentId: "987654",
    paidAt: "2026-09-08T10:00:00Z",
  });
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "ACTIVE" }, [{ ...payment, payment_status: "PENDING" }], expected, inrAmountToPaise).state, "pending");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "FAILED" }], expected, inrAmountToPaise).state, "failed");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "CANCELLED" }], expected, inrAmountToPaise).state, "cancelled");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "USER_DROPPED" }], expected, inrAmountToPaise).state, "user_dropped");
  assert.throws(() => validateCashfreeEarlyAccessEvidence({ ...order, order_amount: 500 }, [payment], expected, inrAmountToPaise), /EVIDENCE_MISMATCH/);
});

test("database finalization makes access and credits atomic and idempotent", () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /provider = p_provider/i);
  assert.match(migration, /on conflict \(workspace_id, grant_type\) do nothing/i);
  assert.match(migration, /on conflict \(source_payment_id\).*do nothing/i);
  assert.match(migration, /credits_allocated[\s\S]*3000/);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
  assert.match(migration, /revoke all[\s\S]*authenticated/i);
});

test("signed webhook re-fetches provider state before using the same finalization path", () => {
  assert.match(webhook, /verifyCashfreeWebhookSignature\(rawBody, timestamp, signature\)/);
  assert.ok(webhook.indexOf("verifyCashfreeWebhookSignature") < webhook.indexOf("JSON.parse(rawBody)"));
  assert.match(webhook, /PAYMENT_SUCCESS_WEBHOOK/);
  assert.match(webhook, /PAYMENT_FAILED_WEBHOOK/);
  assert.match(webhook, /PAYMENT_USER_DROPPED_WEBHOOK/);
  assert.match(webhook, /getCashfreeOrder/);
  assert.match(webhook, /getCashfreePaymentsForOrder/);
  assert.match(webhook, /finalize_early_access_purchase/);
});

test("browser checkout uses Cashfree v3 and never treats browser data as fulfillment evidence", () => {
  assert.match(checkout, /https:\/\/sdk\.cashfree\.com\/js\/v3\/cashfree\.js/);
  assert.match(checkout, /redirectTarget:\s*"_modal"/);
  assert.match(checkout, /body:\s*\{ orderId \}/);
  assert.doesNotMatch(checkout, /razorpay/i);
});

test("active runtime billing surface has no Razorpay integration", () => {
  for (const [name, source] of [
    ["checkout", checkout],
    ["create function", createFunction],
    ["verify function", verifyFunction],
    ["webhook", webhook],
    ["edge config", config],
    ["billing config", billingConfig],
    ["Cashfree helper", cashfree],
    ["package manifest", packageManifest],
  ]) {
    assert.doesNotMatch(source, /razorpay/i, `${name} still references Razorpay`);
  }
});

```

### `supabase/functions/_shared/cashfree.ts`

```typescript
export const CASHFREE_API_VERSION = "2023-08-01";

declare const Deno: { env: { get(key: string): string | undefined } };

export type CashfreeEnvironment = "sandbox" | "production";

export type CashfreeOrder = {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  customer_details?: {
    customer_id?: string;
    customer_email?: string;
    customer_phone?: string;
    customer_name?: string;
  };
  order_tags?: Record<string, string> | null;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  order_id: string;
  order_amount: number;
  order_currency: string;
  payment_amount: number;
  payment_currency: string;
  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
  payment_time?: string;
  payment_completion_time?: string;
};

export type CashfreeEarlyAccessEvidence = {
  state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";
  paymentId: string | null;
  paidAt: string | null;
};

type CashfreeConfig = {
  appId: string;
  secretKey: string;
  environment: CashfreeEnvironment;
  baseUrl: string;
};

export class CashfreeApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errorType: string | null;
  readonly requestId: string;

  constructor(
    message: string,
    status: number,
    code: string | null,
    errorType: string | null,
    requestId: string,
  ) {
    super(message);
    this.name = "CashfreeApiError";
    this.status = status;
    this.code = code;
    this.errorType = errorType;
    this.requestId = requestId;
  }
}

export function getCashfreeConfig(): CashfreeConfig {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
  let environment = Deno.env.get("CASHFREE_ENV") as CashfreeEnvironment | undefined;
  
  if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");
  
  // Auto-detect environment if it's mismatched or missing, since Sandbox IDs always start with TEST
  const detectedEnv = appId.startsWith("TEST") ? "sandbox" : "production";
  if (environment !== detectedEnv) {
    console.log(`[Cashfree Config] Auto-correcting environment to ${detectedEnv} based on App ID prefix.`);
    environment = detectedEnv;
  }

  return {
    appId,
    secretKey,
    environment,
    baseUrl: environment === "sandbox"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg",
  };
}

async function cashfreeRequest<T>(
  path: string,
  requestId: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const config = getCashfreeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        "x-request-id": requestId,
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new CashfreeApiError(
        typeof data?.message === "string" ? data.message : "Cashfree request failed.",
        response.status,
        typeof data?.code === "string" ? data.code : null,
        typeof data?.type === "string" ? data.type : null,
        requestId,
      );
    }
    return data as T;
  } catch (error: unknown) {
    if (error instanceof CashfreeApiError) throw error;
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Cashfree request timed out."
      : "Unable to reach Cashfree.";
    throw new CashfreeApiError(message, 0, null, "network_error", requestId);
  } finally {
    clearTimeout(timeout);
  }
}

export function createCashfreeOrder(
  payload: Record<string, unknown>,
  requestId: string,
  idempotencyKey: string,
) {
  return cashfreeRequest<CashfreeOrder>(
    "/orders",
    requestId,
    { method: "POST", body: JSON.stringify(payload) },
    idempotencyKey,
  );
}

export function getCashfreeOrder(orderId: string, requestId: string) {
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);
}

export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {
  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);
}

export function validateCashfreeEarlyAccessEvidence(
  order: CashfreeOrder,
  payments: CashfreePayment[],
  expected: {
    orderId: string;
    workspaceId: string;
    internalPaymentId: string;
    amountPaise: number;
    currency: string;
    paymentType: string;
  },
  amountToPaise: (value: string | number) => number | null,
): CashfreeEarlyAccessEvidence {
  if (
    order.order_id !== expected.orderId
    || amountToPaise(order.order_amount) !== expected.amountPaise
    || order.order_currency !== expected.currency
    || order.customer_details?.customer_id !== expected.workspaceId
    || order.order_tags?.product !== expected.paymentType
    || order.order_tags?.workspace_id !== expected.workspaceId
    || order.order_tags?.internal_payment_id !== expected.internalPaymentId
  ) {
    throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");
  }

  const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");
  const successfulPayment = successfulPayments.find((payment) => (
    payment.order_id === expected.orderId
    && amountToPaise(payment.order_amount) === expected.amountPaise
    && payment.payment_currency === expected.currency
  ));
  if (successfulPayments.length > 0 && !successfulPayment) {
    throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");
  }
  if (order.order_status === "PAID" && successfulPayment) {
    return {
      state: "paid",
      paymentId: String(successfulPayment.cf_payment_id),
      paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),
    };
  }

  const statuses = new Set(payments.map((payment) => payment.payment_status));
  if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {
    return { state: "pending", paymentId: null, paidAt: null };
  }
  if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };
  if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };
  if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };
  if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };
  return { state: "pending", paymentId: null, paidAt: null };
}

export async function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
) {
  const { secretKey } = getCashfreeConfig();
  let supplied: Uint8Array<ArrayBuffer>;
  try {
    supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    supplied,
    encoder.encode(`${timestamp}${rawBody}`),
  );
}

```

### `supabase/functions/billing-create-early-access/index.ts`

```typescript
// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";
import { CashfreeApiError, type CashfreeOrder, createCashfreeOrder, getCashfreeConfig, getCashfreeOrder } from "../_shared/cashfree.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyClerkToken } from "../_shared/clerk.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const phone = value.replace(/[\s()-]/g, "");
  const match = phone.match(/(\d{10})$/);
  return match ? match[1] : null;
}

function getAppBaseUrl() {
  const value = Deno.env.get("APP_BASE_URL");
  if (!value) throw new Error("APP_BASE_URL is not configured.");
  
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error("APP_BASE_URL is not a valid URL.");
  }

  if (getCashfreeConfig().environment === "production" && url.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use HTTPS in production.");
  }
  return url.toString().replace(/\/$/, "");
}

function orderMatchesIntent(order: CashfreeOrder, orderId: string, workspaceId: string, paymentId: string) {
  return order.order_id === orderId
    && inrAmountToPaise(order.order_amount) === EARLY_ACCESS.totalPaise
    && order.order_currency === EARLY_ACCESS.currency
    && order.customer_details?.customer_id === workspaceId
    && order.order_tags?.product === EARLY_ACCESS.paymentType
    && order.order_tags?.workspace_id === workspaceId
    && order.order_tags?.internal_payment_id === paymentId;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);

  const requestId = `cashfree_create_${crypto.randomUUID()}`;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required.", requestId }, 401);
    }
    const userId = await verifyClerkToken(req, authHeader.slice(7));
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const customerPhone = normalizePhone(body?.customerPhone);
    if (!customerPhone) {
      return json({ ok: false, code: "PHONE_REQUIRED", message: "Enter a valid phone number to continue with Cashfree checkout.", requestId }, 400);
    }

    const cashfreeConfig = getCashfreeConfig();
    const appBaseUrl = getAppBaseUrl();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured.");
    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error: profileSetupError } = await admin.from("profiles").upsert(
      { id: userId, clerk_user_id: userId },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileSetupError) {
      console.error(`[${requestId}] workspace_profile_failed`, profileSetupError.message);
      return json({ ok: false, code: "WORKSPACE_SETUP_FAILED", message: "Your account is still being prepared. Please try again shortly.", requestId }, 503);
    }

    const [{ data: profile }, { data: existingGrant }, { data: existingPayment }, { data: activeSubscription }] = await Promise.all([
      admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
      admin.from("billing_access_grants").select("id").eq("workspace_id", userId).eq("grant_type", EARLY_ACCESS.paymentType).maybeSingle(),
      admin.from("billing_payments").select("id, provider_order_id, status, amount_paise, currency").eq("workspace_id", userId).eq("provider", "cashfree").eq("payment_type", EARLY_ACCESS.paymentType).in("status", ["creating", "active", "attempted", "pending", "paid"]).maybeSingle(),
      admin.from("billing_subscriptions").select("id, status, current_period_end").eq("workspace_id", userId).maybeSingle(),
    ]);

    const subscriptionStillActive = activeSubscription
      && (activeSubscription.status === "active"
        || activeSubscription.status === "trialing"
        || (activeSubscription.status === "cancelled" && activeSubscription.current_period_end && new Date(activeSubscription.current_period_end) > new Date()));
    if (subscriptionStillActive) return json({ ok: false, code: "ACCOUNT_ALREADY_HAS_ACCESS", message: "This account already has active AdsHunting access.", requestId }, 409);
    if (existingGrant || existingPayment?.status === "paid") return json({ ok: false, code: "EARLY_ACCESS_ALREADY_ACTIVE", message: "Early Access is already active for this account.", requestId }, 409);
    if (!profile?.email) return json({ ok: false, code: "EMAIL_REQUIRED", message: "Add an email address to your AdsHunting account before checkout.", requestId }, 400);

    let paymentId = existingPayment?.id as string | undefined;
    let orderId = existingPayment?.provider_order_id as string | undefined;

    if (paymentId && orderId) {
      if (Number(existingPayment.amount_paise) !== EARLY_ACCESS.totalPaise || existingPayment.currency !== EARLY_ACCESS.currency) {
        return json({ ok: false, code: "PAYMENT_EVIDENCE_MISMATCH", message: "The existing checkout does not match the Early Access price.", requestId }, 409);
      }
      try {
        const order = await getCashfreeOrder(orderId, requestId);
        if (!orderMatchesIntent(order, orderId, userId, paymentId)) {
          return json({ ok: false, code: "PAYMENT_EVIDENCE_MISMATCH", message: "Cashfree order details did not match this purchase.", requestId }, 409);
        }
        if (order.order_status === "PAID") {
          return json({ ok: true, orderId, paymentSessionId: null, mode: cashfreeConfig.environment, paymentPendingVerification: true, requestId });
        }
        if (order.order_status === "ACTIVE" && order.payment_session_id) {
          return json({ ok: true, orderId, paymentSessionId: order.payment_session_id, mode: cashfreeConfig.environment, reused: true, requestId });
        }
        await admin.from("billing_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", paymentId);
        return json({ ok: false, code: "ORDER_NOT_PAYABLE", message: "The previous Cashfree order is no longer payable. Please try again.", requestId }, 409);
      } catch (error: unknown) {
        if (!(error instanceof CashfreeApiError) || error.status !== 404) throw error;
        // A prior network failure may have left a local intent before Cashfree
        // accepted it. Retry the same order ID and idempotency key below.
      }
    }

    if (!paymentId || !orderId) {
      const newPaymentId = crypto.randomUUID();
      const newOrderId = `ea_${newPaymentId.replaceAll("-", "")}`;
      const { data: createdIntent, error: intentError } = await admin
        .from("billing_payments")
        .insert({
          id: newPaymentId,
          workspace_id: userId,
          provider: "cashfree",
          provider_order_id: newOrderId,
          payment_type: EARLY_ACCESS.paymentType,
          base_amount_paise: EARLY_ACCESS.basePricePaise,
          gst_amount_paise: EARLY_ACCESS.gstPaise,
          gst_rate: EARLY_ACCESS.gstRate,
          amount_paise: EARLY_ACCESS.totalPaise,
          currency: EARLY_ACCESS.currency,
          status: "creating",
        })
        .select("id, provider_order_id")
        .single();
      if (intentError || !createdIntent) {
        if (intentError?.code === "23505") return json({ ok: false, code: "CHECKOUT_IN_PROGRESS", message: "A checkout is already in progress for this account.", requestId }, 409);
        console.error(`[${requestId}] cashfree_intent_failed`, intentError?.message);
        return json({ ok: false, code: "CHECKOUT_CREATE_FAILED", message: "Unable to prepare checkout. Please try again.", requestId, errorDetails: intentError }, 500);
      }
      paymentId = createdIntent.id;
      orderId = createdIntent.provider_order_id;
    }

    if (!paymentId || !orderId) {
      throw new Error("Invariant failed: paymentId or orderId is missing.");
    }

    const orderPayload = {
      order_id: orderId,
      order_amount: Number(EARLY_ACCESS.totalAmountInr),
      order_currency: EARLY_ACCESS.currency,
      customer_details: {
        customer_id: userId,
        customer_name: profile.full_name || undefined,
        customer_email: profile.email,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${appBaseUrl}/billing?order_id={order_id}`,
        notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
      },
      order_note: "AdsHunting Early Access",
      order_tags: (function buildOrderTags() {
        const tags: Record<string, string> = {
          product: EARLY_ACCESS.paymentType,
          workspace_id: userId,
          internal_payment_id: paymentId,
          credits: String(EARLY_ACCESS.credits),
          checkout_context: "AdsHunting Early Access Payment",
        };

        try {
          const brandImage = new URL("/logo.png", appBaseUrl);
          if (brandImage.protocol === "https:" && brandImage.hostname !== "localhost") {
            tags.brand_image_url = brandImage.toString();
          }
        } catch {
          // Omit optionally if URL is invalid or local
        }
        
        return tags;
      })(),
      products: {
        one_click_checkout: {
          enabled: true,
          conditions: [{
            action: "ALLOW",
            values: ["checkoutCollectAddress", "checkoutAuthenticate"],
            key: "features",
          }],
        },
      },
      cart_details: {
        cart_items: [{
          item_id: "adshunting_early_access",
          item_name: "AdsHunting Early Access",
          item_description: "One-time Early Access with 3,000 product credits",
          item_details_url: `${appBaseUrl}/pricing`,
          item_image_url: `${appBaseUrl}/logo.png`,
          item_original_unit_price: Number(EARLY_ACCESS.totalAmountInr),
          item_discounted_unit_price: Number(EARLY_ACCESS.totalAmountInr),
          item_quantity: 1,
          item_currency: EARLY_ACCESS.currency,
        }],
      },
    };

    try {
      const order = await createCashfreeOrder(orderPayload, requestId, paymentId);
      if (!orderMatchesIntent(order, orderId, userId, paymentId) || !order.payment_session_id) {
        throw new Error("Cashfree returned an invalid order response.");
      }
      const { error: persistError } = await admin.from("billing_payments").update({ status: "active" }).eq("id", paymentId);
      if (persistError) {
        console.error(`[${requestId}] cashfree_order_persist_failed`, paymentId, orderId, persistError.message);
        return json({ ok: false, code: "ORDER_PERSIST_FAILED", message: "Checkout was created but could not be recorded safely. Please contact support.", requestId }, 500);
      }
      console.log(`[${requestId}] cashfree_occ_order_created`, paymentId, userId, orderId);
      return json({ ok: true, orderId, paymentSessionId: order.payment_session_id, mode: cashfreeConfig.environment, requestId });
    } catch (error: unknown) {
      if (error instanceof CashfreeApiError) {
        console.error(`[${requestId}] cashfree_create_failed`, paymentId, userId, orderId, error.status, error.code, error.errorType, error.message);
        if (error.status > 0 && error.status < 500) {
          await admin.from("billing_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", paymentId);
        } else {
          await admin.from("billing_payments").update({ status: "pending" }).eq("id", paymentId);
        }
        return json({
          ok: false,
          code: "CASHFREE_ORDER_CREATE_FAILED",
          providerStatus: error.status,
          providerCode: error.code,
          providerType: error.errorType,
          message: error.message || "Cashfree rejected the checkout request.",
          requestId,
        }, error.status >= 400 && error.status < 600 ? error.status : 503);
      }
      console.error(`[${requestId}] cashfree_order_invalid`, paymentId, userId, orderId, error);
      return json({ ok: false, code: "INVALID_PROVIDER_RESPONSE", message: "Cashfree returned an invalid checkout response.", requestId }, 502);
    }
  } catch (error: unknown) {
    console.error(`[${requestId}] cashfree_create_error`, error instanceof Error ? error.message : String(error));
    const configError = error instanceof Error && (error.message.includes("configured") || error.message.includes("CASHFREE_ENV") || error.message.includes("APP_BASE_URL"));
    return json({ ok: false, code: configError ? "BILLING_CONFIG_MISSING" : "INTERNAL_BILLING_ERROR", message: configError ? "Cashfree checkout is not configured." : "Unable to create checkout.", requestId }, 500);
  }
});

```

### `supabase/functions/billing-verify-early-access/index.ts`

```typescript
// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import { CashfreeApiError, getCashfreeOrder, getCashfreePaymentsForOrder, validateCashfreeEarlyAccessEvidence } from "../_shared/cashfree.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";
import { verifyClerkToken } from "../_shared/clerk.ts";

const ORDER_ID_PATTERN = /^ea_[a-f0-9]{32}$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);

  const requestId = `cashfree_verify_${crypto.randomUUID()}`;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required.", requestId }, 401);
    }
    const workspaceId = await verifyClerkToken(req, authHeader.slice(7));
    const body = await req.json().catch(() => null) as { orderId?: unknown } | null;
    const orderId = typeof body?.orderId === "string" && ORDER_ID_PATTERN.test(body.orderId) ? body.orderId : null;
    if (!orderId) return json({ ok: false, code: "INVALID_ORDER_ID", message: "A valid Cashfree order ID is required.", requestId }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: localPayment, error: paymentError } = await admin
      .from("billing_payments")
      .select("id, workspace_id, provider_order_id, amount_paise, currency, status")
      .eq("workspace_id", workspaceId)
      .eq("provider", "cashfree")
      .eq("provider_order_id", orderId)
      .eq("payment_type", EARLY_ACCESS.paymentType)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!localPayment) return json({ ok: false, code: "PAYMENT_NOT_FOUND", message: "This order does not belong to the signed-in account.", requestId }, 404);

    if (localPayment.status === "paid") {
      return json({ ok: true, active: true, alreadyProcessed: true, requestId });
    }
    if (Number(localPayment.amount_paise) !== EARLY_ACCESS.totalPaise || localPayment.currency !== EARLY_ACCESS.currency) {
      throw new Error("LOCAL_PAYMENT_EVIDENCE_MISMATCH");
    }

    const [order, payments] = await Promise.all([
      getCashfreeOrder(orderId, requestId),
      getCashfreePaymentsForOrder(orderId, requestId),
    ]);
    const evidence = validateCashfreeEarlyAccessEvidence(order, payments, {
      orderId,
      workspaceId,
      internalPaymentId: localPayment.id,
      amountPaise: EARLY_ACCESS.totalPaise,
      currency: EARLY_ACCESS.currency,
      paymentType: EARLY_ACCESS.paymentType,
    }, inrAmountToPaise);
    console.log(`[${requestId}] cashfree_verification_state`, localPayment.id, workspaceId, orderId, evidence.state);

    if (evidence.state === "paid" && evidence.paymentId && evidence.paidAt) {
      const { data: result, error: finalizeError } = await admin.rpc("finalize_early_access_purchase", {
        p_workspace_id: workspaceId,
        p_provider: "cashfree",
        p_order_id: orderId,
        p_payment_id: evidence.paymentId,
        p_paid_at: evidence.paidAt,
      });
      if (finalizeError) {
        console.error(`[${requestId}] cashfree_provisioning_failed`, localPayment.id, workspaceId, orderId, finalizeError.message);
        return json({
          ok: false,
          code: "ACCESS_PROVISIONING_FAILED",
          message: "Payment was received, but access provisioning is delayed. Retry verification; do not pay again.",
          requestId,
        }, 503);
      }
      console.log(`[${requestId}] cashfree_early_access_finalized`, workspaceId, orderId, evidence.paymentId);
      return json({ ok: true, active: true, ...result, requestId });
    }

    if (evidence.state === "pending") {
      await admin.from("billing_payments").update({ status: "pending" }).eq("id", localPayment.id).neq("status", "paid");
      return json({ ok: true, active: false, processing: true, status: "pending", message: "Cashfree is still confirming this payment.", requestId }, 202);
    }

    const providerOrderStillPayable = order.order_status === "ACTIVE";
    await admin.from("billing_payments").update({
      status: providerOrderStillPayable ? "active" : evidence.state,
      failed_at: providerOrderStillPayable ? null : new Date().toISOString(),
    }).eq("id", localPayment.id).neq("status", "paid");
    const cancelled = evidence.state === "cancelled" || evidence.state === "user_dropped";
    return json({
      ok: false,
      active: false,
      code: cancelled ? "PAYMENT_CANCELLED" : "PAYMENT_FAILED",
      status: evidence.state,
      message: cancelled ? "Cashfree checkout was cancelled. No access or credits were applied." : "The payment was not successful. No access or credits were applied.",
      requestId,
    }, 409);
  } catch (error: unknown) {
    if (error instanceof CashfreeApiError) {
      console.error(`[${requestId}] cashfree_verify_provider_error`, error.status, error.code, error.errorType, error.message);
      return json({
        ok: false,
        code: "VERIFICATION_UNAVAILABLE",
        message: "Payment verification is temporarily unavailable. Please retry; do not pay again.",
        requestId,
      }, 503);
    }
    
    console.error(`[${requestId}] cashfree_verify_error`, error instanceof Error ? error.message : String(error));
    const mismatch = error instanceof Error && error.message.includes("EVIDENCE_MISMATCH");
    return json({
      ok: false,
      code: mismatch ? "PAYMENT_EVIDENCE_MISMATCH" : "VERIFICATION_UNAVAILABLE",
      message: mismatch ? "Cashfree payment details did not match this purchase." : "An unexpected error occurred during verification. Please retry; do not pay again.",
      requestId,
    }, mismatch ? 409 : 503);
  }
});

```

### `supabase/functions/cashfree-webhook/index.ts`

```typescript
// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import {
  getCashfreeOrder,
  getCashfreePaymentsForOrder,
  validateCashfreeEarlyAccessEvidence,
  verifyCashfreeWebhookSignature,
} from "../_shared/cashfree.ts";
import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";

const SUPPORTED_EVENTS = new Set([
  "PAYMENT_SUCCESS_WEBHOOK",
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
]);

type CashfreeWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number };
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ received: false, message: "Method not allowed." }, 405);

  const requestId = `cashfree_webhook_${crypto.randomUUID()}`;
  let eventId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return json({ received: false, message: "Missing Cashfree signature headers." }, 400);

    const validSignature = await verifyCashfreeWebhookSignature(rawBody, timestamp, signature);
    if (!validSignature) return json({ received: false, message: "Invalid Cashfree signature." }, 401);

    const event = JSON.parse(rawBody) as CashfreeWebhook;
    const type = event.type;
    const orderId = event.data?.order?.order_id;
    if (!type || !orderId) return json({ received: false, message: "Invalid Cashfree webhook payload." }, 400);

    const suppliedEventId = req.headers.get("x-idempotency-key");
    eventId = `cashfree:${suppliedEventId || await sha256(rawBody)}`;
    admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: existingEvent } = await admin
      .from("billing_webhook_events")
      .select("id, processing_status")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (existingEvent?.processing_status === "processed") {
      return json({ received: true, duplicate: true });
    }
    if (!existingEvent) {
      const { error: eventInsertError } = await admin.from("billing_webhook_events").insert({
        provider: "cashfree",
        provider_event_id: eventId,
        event_type: type,
        payment_id: event.data?.payment?.cf_payment_id ? String(event.data.payment.cf_payment_id) : null,
        payload_json: event,
        processing_status: "pending",
      });
      if (eventInsertError && eventInsertError.code !== "23505") throw eventInsertError;
    }

    if (!SUPPORTED_EVENTS.has(type)) {
      await admin.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return json({ received: true, ignored: true });
    }

    const { data: localPayment, error: paymentError } = await admin
      .from("billing_payments")
      .select("id, workspace_id, amount_paise, currency, status")
      .eq("provider", "cashfree")
      .eq("provider_order_id", orderId)
      .eq("payment_type", EARLY_ACCESS.paymentType)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!localPayment) {
      await admin.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return json({ received: true, ignored: true });
    }
    if (Number(localPayment.amount_paise) !== EARLY_ACCESS.totalPaise || localPayment.currency !== EARLY_ACCESS.currency) {
      throw new Error("LOCAL_PAYMENT_EVIDENCE_MISMATCH");
    }

    // The signed webhook is a trigger, never the authority for fulfillment.
    // Re-fetch both provider resources before applying access or credits.
    const [order, payments] = await Promise.all([
      getCashfreeOrder(orderId, requestId),
      getCashfreePaymentsForOrder(orderId, requestId),
    ]);
    const evidence = validateCashfreeEarlyAccessEvidence(order, payments, {
      orderId,
      workspaceId: localPayment.workspace_id,
      internalPaymentId: localPayment.id,
      amountPaise: EARLY_ACCESS.totalPaise,
      currency: EARLY_ACCESS.currency,
      paymentType: EARLY_ACCESS.paymentType,
    }, inrAmountToPaise);
    console.log(`[${requestId}] cashfree_webhook_state`, localPayment.id, localPayment.workspace_id, orderId, evidence.state);

    if (evidence.state === "paid" && evidence.paymentId && evidence.paidAt) {
      const { error: finalizeError } = await admin.rpc("finalize_early_access_purchase", {
        p_workspace_id: localPayment.workspace_id,
        p_provider: "cashfree",
        p_order_id: orderId,
        p_payment_id: evidence.paymentId,
        p_paid_at: evidence.paidAt,
      });
      if (finalizeError) throw finalizeError;
      console.log(`[${requestId}] cashfree_webhook_finalized`, localPayment.workspace_id, orderId, evidence.paymentId);
    } else if (evidence.state === "pending") {
      await admin.from("billing_payments").update({ status: "pending" }).eq("id", localPayment.id).neq("status", "paid");
    } else {
      const providerOrderStillPayable = order.order_status === "ACTIVE";
      await admin.from("billing_payments").update({
        status: providerOrderStillPayable ? "active" : evidence.state,
        failed_at: providerOrderStillPayable ? null : new Date().toISOString(),
      }).eq("id", localPayment.id).neq("status", "paid");
    }

    await admin.from("billing_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq("provider_event_id", eventId);
    return json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] cashfree_webhook_error`, message);
    if (admin && eventId) {
      await admin.from("billing_webhook_events").update({ processing_status: "failed", error_message: message.slice(0, 500) }).eq("provider_event_id", eventId);
    }
    return json({ received: false, message: "Webhook reconciliation failed." }, 500);
  }
});

```

## 2. Core Search, Ingestion & Stubbed Modules (Full Contents)

### `app/api/search/route.ts`

```typescript
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { dbAdToNormalized } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { getWorkspaceCreditBalance, consumeUsage, CREDIT_COSTS } from "@/lib/billing/usage";
import crypto from "crypto";
import { ProviderError } from "@/lib/providers/errors";
import { adsForClient, persistNormalizedAds, archiveAdsInBackground } from "@/lib/ads-persistence";
import { isPreviewMode } from "@/lib/preview";
import type { AdSearchFilters, AdSearchResult, NormalizedAd, SearchIntent } from "@/lib/types";
import { normalizeDiscoverFilters } from "@/lib/filter-utils";
import { auth } from "@clerk/nextjs/server";
import { getServerEnv } from "@/lib/env/server";
import { brandFromRow, realAdvertiserName, resolveAdIdentities } from "@/lib/advertiser-identity";
import { getAdProviders } from "@/lib/providers";
import { resolveAdMedia } from "@/lib/media";
import { calculateWinnerScore } from "@/lib/intelligence";
import { signArchivedAdMedia } from "@/lib/media-access";

const schema = z.object({
  query: z.string().trim().max(160).optional(),
  brand: z.string().max(80).optional(),
  selectedBrand: z.object({
    id: z.string().min(1).max(80), name: z.string().trim().min(1).max(300),
    provider: z.enum(["meta", "foreplay"]), providerAdvertiserId: z.string().min(1).max(80),
    logoUrl: z.string().url().max(4000).nullable().optional(),
    profileUrl: z.string().url().max(4000).nullable().optional(),
    domain: z.string().max(300).nullable().optional(),
  }).optional(),
  platforms: z.array(z.enum(["facebook", "instagram", "messenger", "audience_network", "threads"])).max(5).optional(),
  sort: z.string().max(32).optional(),
  cursor: z.string().max(16_000).optional(),
  sessionId: z.string().max(64).optional(),
  cta: z.string().max(40).optional(),
  source: z.literal("competitor").optional(),

  // Legacy singular
  status: z.enum(["all", "active", "inactive"]).default("all"),
  country: z.string().max(8).optional(),
  mediaType: z.enum(["all", "image", "video", "carousel", "unknown"]).optional(),
  language: z.string().max(16).optional(),
  duration: z.string().max(20).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),

  // New plural
  formats: z.array(z.enum(["image", "video", "carousel", "unknown"])).optional(),
  statuses: z.array(z.enum(["active", "inactive", "unknown"])).optional(),
  markets: z.array(z.string().max(8)).optional(),
  languages: z.array(z.string().max(16)).optional(),
  niches: z.array(z.string().max(32)).optional(),
  contentStyles: z.array(z.string().max(32)).optional(),
  
  runtime: z.object({
    preset: z.string().optional(),
    minDays: z.number().nonnegative().optional(),
    maxDays: z.number().nonnegative().optional(),
  }).optional(),
  
  videoLength: z.object({
    preset: z.string().optional(),
    minSeconds: z.number().nonnegative().optional(),
    maxSeconds: z.number().nonnegative().optional(),
  }).optional(),
});

type CacheEntry = { expires: number; payload: AdSearchResult };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AdSearchResult>>();

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const accessError = await requirePaidWorkspaceAccess();
    if (accessError) return accessError;

    let catalogClient: Awaited<ReturnType<typeof requireUser>>["supabase"] = null;
    const authRes = await requireUser();
    if (authRes.error || !authRes.user) return authRes.error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    catalogClient = authRes.supabase;

    const rawBody = await request.json().catch(() => ({}));
    const cleanBody = Object.fromEntries(
      Object.entries(rawBody).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
      )
    );

    const balance = await getWorkspaceCreditBalance(authRes.user.id);
    const isNewSearch = !rawBody?.cursor;
    const baseCost = isNewSearch ? CREDIT_COSTS.AD_SEARCH : 0;
  
    if (balance && !balance.unlimited && baseCost > 0 && balance.creditsRemaining !== null && balance.creditsRemaining < baseCost) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS", reason: "out_of_credits", creditsRemaining: balance.creditsRemaining, code: "INSUFFICIENT_CREDITS" },
        { status: 402 }
      );
    }

  if (isSupabaseConfigured && !isPreviewMode) {
    // Already authenticated above
  } else if (isSupabaseConfigured && isPreviewMode) {
    // Already authenticated above
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const limit = rateLimit(`search:${ip}`, 40);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const parsed = schema.safeParse(cleanBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search filters.", code: "INVALID_FILTERS", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const filters = normalizeDiscoverFilters(parsed.data);
  
  // Prefer the existing catalog mapping over client navigation context.
  if (filters.brand && catalogClient) {
    const { data } = await catalogClient.from("ads").select("*")
      .eq("advertiser_id", filters.brand).order("last_seen_at", { ascending: false }).limit(100);
    const known = (data || []).map(brandFromRow).find(brand => brand &&
      (!filters.selectedBrand || brand.provider === filters.selectedBrand.provider));
    if (known) filters.selectedBrand = known;
  }
  let resolvedIntent: SearchIntent | undefined = undefined;

  if (filters.brand) {
    resolvedIntent = { type: "advertiser", advertiserId: filters.brand, advertiserName: filters.selectedBrand?.name || "" };
  } else if (filters.query) {
    resolvedIntent = { type: "keyword", query: filters.query };
  }
  
  // Sort array fields for stable cache key
  const normalizedFilters = { ...filters };
  if (normalizedFilters.platforms) normalizedFilters.platforms.sort();
  if (normalizedFilters.formats) normalizedFilters.formats.sort();
  if (normalizedFilters.statuses) normalizedFilters.statuses.sort();
  if (normalizedFilters.markets) normalizedFilters.markets.sort();
  if (normalizedFilters.languages) normalizedFilters.languages.sort();
  if (normalizedFilters.niches) normalizedFilters.niches.sort();
  if (normalizedFilters.contentStyles) normalizedFilters.contentStyles.sort();
  
  const sessionId = parsed.data.sessionId || requestId;
  
  const searchFingerprint = crypto.createHash("sha256").update(
    (filters.brand ? "BRAND:" : "SEARCH:") + 
    (filters.query || "") + ":" + 
    JSON.stringify({
      brand: filters.brand,
      platforms: normalizedFilters.platforms,
      sort: normalizedFilters.sort,
      formats: normalizedFilters.formats,
      statuses: normalizedFilters.statuses,
      markets: normalizedFilters.markets,
      languages: normalizedFilters.languages,
      niches: normalizedFilters.niches,
      contentStyles: normalizedFilters.contentStyles,
      country: normalizedFilters.country,
      mediaType: normalizedFilters.mediaType,
      status: normalizedFilters.status,
      cta: normalizedFilters.cta,
      runtime: normalizedFilters.runtime,
      startDate: normalizedFilters.startDate,
      endDate: normalizedFilters.endDate
    })
  ).digest("hex");

  const key = JSON.stringify(normalizedFilters);
  const isDefaultDiscoverFeed = !filters.query && !filters.brand;
  const cached = cache.get(key);
  if (!isDefaultDiscoverFeed && cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...cached.payload, requestId, source: "cache" }, {
      headers: { "Cache-Control": "no-store" }
    });
  }
  if (cached) cache.delete(key);

  let payload: AdSearchResult | null = null;

  // 1. Check Supabase preload/cache first if query is empty or requesting discovery feed
    // For competitors, ALWAYS use the DB because their ads are synced manually.
    if (isSupabaseConfigured && (!filters.cursor || /^\d+$/.test(filters.cursor))) {
      try {
        let query = catalogClient!.from("ads").select("*", { count: "exact" });
        const defaultFeed = !filters.query && !filters.brand;
        const hasActiveFilters = Boolean(
          filters.formats?.length || filters.statuses?.length || filters.markets?.length ||
          filters.platforms?.length || filters.country && filters.country !== "ALL" ||
          filters.status && filters.status !== "all" || filters.mediaType && filters.mediaType !== "all" ||
          filters.cta || filters.runtime || filters.startDate || filters.endDate
        );
        if (filters.brand) query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
        else if (filters.query) {
          const q = filters.query.replace(/[%_,().]/g, " ").trim();
          query = query.or(`headline.ilike.%${q}%,body.ilike.%${q}%,advertiser_name.ilike.%${q}%`);
        } else {
          query = query.not("advertiser_name", "is", null).neq("advertiser_name", "");
        }
        if (filters.selectedBrand) query = query.in("source", filters.selectedBrand.provider === "meta" ? ["meta", "meta_official", "searchapi", "metaapi_io"] : ["foreplay"]);
        
        // Apply Plural filters
        if (filters.formats?.length) query = query.in("media_type", filters.formats);
        if (filters.statuses?.length) query = query.in("status", filters.statuses);
        if (filters.markets?.length) query = query.in("country", filters.markets);
        if (filters.platforms?.length) query = query.contains("platforms", filters.platforms);
        
        // Legacy singular filters
        if (filters.status && filters.status !== "all" && !filters.statuses?.length) query = query.eq("status", filters.status);
        if (filters.mediaType && filters.mediaType !== "all" && !filters.formats?.length) query = query.eq("media_type", filters.mediaType);
        if (filters.country && filters.country !== "ALL" && !filters.markets?.length) query = query.eq("country", filters.country);
        if (filters.cta) query = query.ilike("cta", `%${filters.cta}%`);

        if (filters.runtime) {
          if (filters.runtime.minDays !== undefined) query = query.gte("running_days", filters.runtime.minDays);
          if (filters.runtime.maxDays !== undefined) query = query.lte("running_days", filters.runtime.maxDays);
        }
        
        // Determine pagination
        const limit = 30;
        const offset = filters.cursor ? parseInt(filters.cursor, 10) : 0;

        // Apply sort
        if (filters.sort === "newest") {
          query = query.order("start_date", { ascending: false, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "oldest") {
          query = query.order("start_date", { ascending: true, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "longest") {
          query = query.order("running_days", { ascending: false, nullsFirst: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else if (filters.sort === "variations") {
          // Fallback if variations sort isn't natively supported on DB
          query = query.order("last_seen_at", { ascending: false });
          query = query.order("canonical_ad_id", { ascending: true });
        } else {
          // "relevant" - use a seeded pseudo-random sort for variety if it's a brand profile, otherwise newest
          if (filters.brand) {
            // Postgres lacks a simple seeded random for string IDs without extension, 
            // but we can sort by last_seen_at DESC as a stable proxy, 
            // or simply canonical_ad_id for stability.
            // A more varied feed can be simulated by ordering by start_date DESC.
            query = query.order("start_date", { ascending: false, nullsFirst: false });
            query = query.order("canonical_ad_id", { ascending: true });
          } else {
            query = query.order("last_seen_at", { ascending: false });
            query = query.order("canonical_ad_id", { ascending: true });
          }
        }

        let rangeStart = offset;
        let rangeEnd = offset + limit;
        if (defaultFeed && !filters.cursor && !hasActiveFilters) {
          const { count } = await catalogClient!.from("ads").select("id", { count: "exact", head: true })
            .not("advertiser_name", "is", null).neq("advertiser_name", "");
          const maxStart = Math.max(0, (count || 0) - 1000);
          rangeStart = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0;
          rangeEnd = rangeStart + 999;
        } else if (defaultFeed) {
          rangeEnd = offset + 999;
        }
        query = query.range(rangeStart, rangeEnd);

        const { data, error } = await query;

        if (!error && data) {
          const sampleRows = data;
          if (defaultFeed && !filters.cursor && !hasActiveFilters && sampleRows.length) {
            const seen = new Set(sampleRows.map(row => row.canonical_ad_id || row.id));
            const { count } = await catalogClient!.from("ads").select("id", { count: "exact", head: true })
              .not("advertiser_name", "is", null).neq("advertiser_name", "");
            const maxStart = Math.max(0, (count || 0) - 120);
            for (let i = 0; i < 8 && sampleRows.length < 1000; i++) {
              const start = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0;
              const { data: extra } = await catalogClient!.from("ads").select("*")
                .not("advertiser_name", "is", null).neq("advertiser_name", "")
                .order("last_seen_at", { ascending: false })
                .order("canonical_ad_id", { ascending: true })
                .range(start, start + 119);
              for (const row of extra || []) {
                const id = row.canonical_ad_id || row.id;
                if (!seen.has(id)) {
                  seen.add(id);
                  sampleRows.push(row);
                }
            }
            }
          }
          const hasMore = sampleRows.length > limit;
          const sourceData = defaultFeed
            ? takeDefaultFeed(sampleRows, limit, filters)
            : (hasMore ? data.slice(0, limit) : data).map(dbAdToNormalized);
          const renderableSourceData = sourceData.filter(hasRenderableMedia);
          const pagedData = hasMore ? data.slice(0, limit) : data;
          
          const canonical = data.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
          const ads = ensureWinnerScores(resolveAdIdentities(renderableSourceData, canonical, filters.selectedBrand, filters.brand));
          
          // No longer deduplicating aggressively by ad.id because canonical_ad_id is unique per creative variant.
          // The UI will group them if needed, but the search API returns all variants.
          
          const nextOffset = offset + limit;
          const nextCursor = hasMore ? nextOffset.toString() : null;
          
          if (ads.length || filters.source === "competitor" || filters.cursor) payload = {
            ads: adsForClient(ads), 
            nextCursor, 
            total: defaultFeed ? ads.length : pagedData.length,
            source: "catalog" 
          };
        } else if (filters.source === "competitor") {
          // Force empty payload if competitor has no ads, bypassing provider fallback
          payload = { ads: [], nextCursor: null, total: 0, source: "catalog" };
        }
      } catch (err) {
        console.error("[DiscoverAds] Supabase error:", err);
      }
    }

    // 2. Call provider if not satisfied by preloaded cache (e.g. we have a search query)
    const hasLiveSearchIntent = Boolean(filters.query?.trim() || filters.brand);
    
    let canUseProvider = false;
    let capabilityMismatch = false;
    try {
      if (hasLiveSearchIntent) {
        getAdProviders(filters);
        canUseProvider = true;
      }
    } catch {
      capabilityMismatch = true;
    }
    
    if (!payload && isSupabaseConfigured && filters.source !== "competitor" && hasLiveSearchIntent && canUseProvider) {
      const { getToken } = await auth();
      const token = await getToken();
      
      if (token) {
        const env = getServerEnv();
        const functionUrl = `${env.supabaseUrl}/functions/v1/ads-search`;
        let providerError: unknown = null;
        
        try {
          const requestKey = `edge:${key}`;
          let pending = inFlight.get(requestKey);
          if (!pending) {
            const edgePayload = { ...filters, requestId };
            pending = fetch(functionUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(edgePayload),
              signal: AbortSignal.timeout(28_000)
            }).then(async (res) => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new ProviderError(errData.code || "UNKNOWN", errData.message || "Edge function failed", res.status);
              }
              return res.json() as Promise<AdSearchResult>;
            }).finally(() => inFlight.delete(requestKey));
            
            inFlight.set(requestKey, pending);
          }
          
          const result = await pending;
          const ids = [...new Set(result.ads.map(ad => ad.advertiser?.id).filter((id): id is string => Boolean(id)))];
          const { data: mappings } = ids.length
            ? await catalogClient!.from("ads").select("*").in("advertiser_id", ids).limit(1000)
            : { data: [] };
          const canonical = (mappings || []).map(brandFromRow).filter((b): b is NonNullable<typeof b> => Boolean(b));
          result.ads = ensureWinnerScores(resolveAdIdentities(result.ads, canonical, filters.selectedBrand, filters.brand));
          
            if (result && result.ads && result.ads.length > 0) {
              // Note: We no longer deduplicate by ad.id blindly here.
              // We rely on canonical_ad_id which already encapsulates unique creatives.
              // Duplicates in result.ads are real variants and should be preserved.
              const dedupMap = new Map<string, NormalizedAd>();
              for (const ad of result.ads) {
                if (!dedupMap.has(ad.id)) {
                  dedupMap.set(ad.id, ad);
                }
              }
              result.ads = Array.from(dedupMap.values());
            
            const adsToArchive = result.ads;
            // Complete identity persistence before responding so immediate refresh is consistent.
            const persistence = await persistNormalizedAds(adsToArchive);
            if (persistence.error) throw new ProviderError("PROVIDER_UNAVAILABLE", persistence.error, 502);
            after(() => archiveAdsInBackground(adsToArchive));

            // Apply fingerprint dedupe for UI
            const uiDedupMap = new Map<string, NormalizedAd>();
            for (const ad of result.ads) {
              const groupId = ad.fingerprint || ad.id;
              if (!uiDedupMap.has(groupId)) {
                uiDedupMap.set(groupId, ad);
              }
            }
            const uiAds = Array.from(uiDedupMap.values());

            payload = { ...result, ads: adsForClient(uiAds), requestId };
          } else if (result && result.ads && result.ads.length === 0) {
            payload = { ...result, ads: [], requestId };
          }
        } catch (error) {
          console.error(`[AdsSearch][requestId=${requestId}] Edge function error:`, error);
          providerError = error;
        }

        if (!payload) {
          // Local indexed/cached corpus search for keyword capability
          if (providerError) console.info(`[AdsSearch][requestId=${requestId}] Attempting query-aware cache fallback after provider error`);
          else if (capabilityMismatch) console.info(`[AdsSearch][requestId=${requestId}] Using local corpus due to provider capability mismatch`);
          try {
            let query = catalogClient!.from("ads").select("*", { count: "exact" });
            
            if (filters.brand) {
              query = query.eq("advertiser_id", filters.selectedBrand?.providerAdvertiserId || filters.brand);
            } else if (filters.query) {
              const q = filters.query.trim().replace(/%/g, '\\%');
              query = query.or(`headline.ilike.%${q}%,body.ilike.%${q}%,description.ilike.%${q}%,advertiser_name.ilike.%${q}%`);
            }

            if (filters.formats?.length) query = query.in("media_type", filters.formats);
            if (filters.statuses?.length) query = query.in("status", filters.statuses);
            if (filters.markets?.length) query = query.in("country", filters.markets);
            if (filters.platforms?.length) query = query.contains("platforms", filters.platforms);
            
            if (filters.status && filters.status !== "all" && !filters.statuses?.length) query = query.eq("status", filters.status);
            if (filters.mediaType && filters.mediaType !== "all" && !filters.formats?.length) query = query.eq("media_type", filters.mediaType);
            if (filters.country && filters.country !== "ALL" && !filters.markets?.length) query = query.eq("country", filters.country);
            if (filters.cta) query = query.ilike("cta", `%${filters.cta}%`);

            query = query.order("last_seen_at", { ascending: false }).limit(25);
            
            const offset = filters.cursor ? parseInt(filters.cursor, 10) : 0;
            if (offset > 0) {
              query = query.range(offset, offset + 24);
            }

            const { data } = await query;
            if (data && data.length > 0) {
              const canonical = data.map(brandFromRow).filter((brand): brand is NonNullable<typeof brand> => Boolean(brand));
              const resolved = ensureWinnerScores(resolveAdIdentities(data.map(dbAdToNormalized).filter(hasRenderableMedia), canonical, filters.selectedBrand, filters.brand));
              const deduplicated = Array.from(new Map(resolved.map(ad => [ad.id, ad])).values());
              if (deduplicated.length) {
                payload = { 
                  ads: adsForClient(deduplicated), 
                  nextCursor: data.length === 25 ? (offset + 25).toString() : null, 
                  total: data.length, 
                  source: "cache",
                  stale: true,
                  degraded: true,
                  requestId
                } as AdSearchResult & { stale: boolean; degraded: boolean; requestId: string };
              }
              }
          } catch (cacheErr) {
            console.error(`[AdsSearch][requestId=${requestId}] Cache fallback error:`, cacheErr);
          }
        }
        
        if (!payload && providerError) {
          throw providerError;
        }
      }
    }

    if (payload) {
      payload.ads = ensureWinnerScores(resolveAdIdentities(payload.ads, [], filters.selectedBrand, filters.brand));
      payload.ads = await signArchivedAdMedia(payload.ads);
      payload.brand = filters.selectedBrand;
      if (!isDefaultDiscoverFeed) cache.set(key, { expires: Date.now() + 60_000, payload });
      payload.resolvedIntent = resolvedIntent;
      payload.requestId = requestId;

      // Track user search queries and brand searches asynchronously in background
      const searchQueryText = filters.query || (filters.brand ? `Brand: ${filters.brand}` : null);
      if (searchQueryText && authRes.user && catalogClient) {
        const userId = authRes.user.id;
        const finalQuery = searchQueryText.slice(0, 160);
        after(async () => {
          try {
            await catalogClient
              .from("search_history")
              .insert({
                user_id: userId,
                query: finalQuery,
                searched_at: new Date().toISOString(),
              });
          } catch (trackingErr) {
            console.error("[SearchTracking] Failed to log search history:", trackingErr);
          }
        });
      }

      let finalCredits = null;
      if (payload && payload.ads && filters.source !== "competitor") {
        const deliveryAdIds = payload.ads.map(ad => (ad as any).canonical_ad_id || ad.id).filter((id): id is string => Boolean(id));
        const usageResult = await consumeUsage(
          authRes.user.id,
          authRes.user.id,
          sessionId,
          isNewSearch ? (filters.brand ? "BRAND_SEARCH" : "AD_SEARCH") : null,
          isNewSearch ? searchFingerprint : null,
          baseCost,
          "AD_DELIVERED",
          deliveryAdIds,
          CREDIT_COSTS.AD_DELIVERED
        );

        if (usageResult && usageResult.success && !usageResult.unlimited) {
          if (usageResult.baseCharged === false && baseCost > 0 && usageResult.creditsRemaining !== undefined && usageResult.creditsRemaining < baseCost) {
            return NextResponse.json(
              { error: "INSUFFICIENT_CREDITS", reason: "out_of_credits_concurrent", code: "INSUFFICIENT_CREDITS" },
              { status: 402 }
            );
          }
          
          const acceptedIds = new Set(usageResult.acceptedAdIds || []);
          payload.ads = payload.ads.filter(ad => acceptedIds.has((ad as any).canonical_ad_id || ad.id));
          
          finalCredits = {
            unlimited: false,
            allocated: usageResult.creditsAllocated,
            used: usageResult.creditsUsed,
            remaining: usageResult.creditsRemaining,
            chargedThisRequest: usageResult.creditsChargedThisRequest
          };
        } else if (usageResult && usageResult.unlimited) {
          finalCredits = {
            unlimited: true,
            allocated: null,
            used: null,
            remaining: null,
            chargedThisRequest: 0
          };
        }
      }
      
      if (finalCredits) {
        (payload as any).credits = finalCredits;
      }

      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    payload = { ads: [], nextCursor: null, total: 0, source: "catalog", brand: filters.selectedBrand, resolvedIntent, requestId };
    if (!isDefaultDiscoverFeed) cache.set(key, { expires: Date.now() + 30_000, payload });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message, requestId, retryable: error.status >= 500 || error.status === 429 || error.status === 408 }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable.", requestId, retryable: true },
      { status: 502 }
    );
  }
}


function takeDefaultFeed(rows: Parameters<typeof dbAdToNormalized>[0][], limit: number, filters: AdSearchFilters) {
  const counts = new Map<string, number>();
  return rows
    .map(row => resolveAdIdentities([dbAdToNormalized(row)], brandFromRow(row) ? [brandFromRow(row)!] : [])[0])
    .filter(ad => realAdvertiserName(ad.advertiser?.name, ad.advertiser?.id))
    .filter(hasRenderableMedia)
    .filter(ad => matchesClientFilters(ad, filters))
    .sort(() => Math.random() - 0.5)
    .filter(ad => {
      const key = ad.advertiser?.id || realAdvertiserName(ad.advertiser?.name) || ad.id;
      const count = counts.get(key) || 0;
      if (count >= 5) return false;
      counts.set(key, count + 1);
      return true;
    })
    .slice(0, limit);
}

function hasRenderableMedia(ad: NormalizedAd) {
  const media = resolveAdMedia(ad);
  return Boolean(media.imageUrl || media.videoUrl || media.thumbnailUrl || media.carouselAssets?.length);
}

function matchesClientFilters(ad: NormalizedAd, filters: AdSearchFilters) {
  if (filters.languages?.length && !filters.languages.some(value => ad.delivery.countries.includes(value.toUpperCase()))) return false;
  const haystack = [
    ad.intelligence?.category,
    ad.intelligence?.creativeFormat,
    ad.intelligence?.hookType,
    ad.intelligence?.offerType,
    ...(ad.intelligence?.labels || []),
    ad.copy?.headline,
    ad.copy?.primaryText,
    ad.copy?.description,
  ].filter(Boolean).join(" ").toLowerCase();
  if (filters.niches?.length && !filters.niches.some(value => haystack.includes(value.toLowerCase()))) return false;
  if (filters.contentStyles?.length && !filters.contentStyles.some(value => haystack.includes(value.toLowerCase()))) return false;
  return true;
}

function ensureWinnerScores(ads: NormalizedAd[]) {
  const byAdvertiser = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const key = ad.advertiser?.id || ad.advertiser?.name || "unknown";
    if (!byAdvertiser.has(key)) byAdvertiser.set(key, []);
    byAdvertiser.get(key)!.push(ad);
  }
  return ads.map(ad => {
    const hasEvidence = ad.delivery?.status === "active" ||
      (ad.delivery?.daysRunning ?? 0) > 0 ||
      (ad.variants ?? 1) > 1 ||
      Boolean(ad.destination?.url) ||
      Boolean(ad.delivery?.countries?.length);
    if ((ad.intelligence?.winnerScore ?? null) !== 0 || !hasEvidence) return ad;
    return {
      ...ad,
      intelligence: {
        ...ad.intelligence,
        winnerScore: calculateWinnerScore(ad, { advertiserAds: byAdvertiser.get(ad.advertiser?.id || ad.advertiser?.name || "unknown") || [ad] }),
      },
    };
  });
}

```

### `app/api/competitors/route.ts`

```typescript
import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncCompetitorAds } from "@/lib/brand-data";

export async function GET() {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const { data, error } = await auth.supabase!.from("competitors").select("*").eq("user_id", auth.user!.id).order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ competitors: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(); 
  if (auth.error) return auth.error;
  
  const accessError = await requirePaidWorkspaceAccess(); 
  if (accessError) return accessError;
  
  const parsed = z.object({ 
    advertiserId: z.string().min(1).max(200), 
    advertiserName: z.string().min(1).max(300), 
    advertiserAvatarUrl: z.string().nullable().optional() 
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) 
    return NextResponse.json({ error: "Select a valid advertiser." }, { status: 400 });
  
  // Check if already tracking
  const { data: existingCompetitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .eq("advertiser_id", parsed.data.advertiserId)
    .maybeSingle();
  
  if (existingCompetitor) {
    return NextResponse.json({ 
      competitor: existingCompetitor,
      isNew: false,
      message: "Already tracking this advertiser."
    }, { status: 200 });
  }

  // Create competitor record with sync_status = "syncing"
  const { data: competitor, error: createError } = await auth.supabase!
    .from("competitors")
    .insert({
      user_id: auth.user!.id,
      advertiser_id: parsed.data.advertiserId,
      advertiser_name: parsed.data.advertiserName,
      advertiser_avatar_url: parsed.data.advertiserAvatarUrl,
      sync_status: "syncing",
      ads_count: -1
    })
    .select()
    .single();
  
  if (createError) 
    return NextResponse.json({ error: createError.message }, { status: 400 });
  
  // Initiate sync and AWAIT completion
  let syncError: string | null = null;
  let adsCount = 0;
  
  try {
    const persisted = await syncCompetitorAds(parsed.data.advertiserId);
    
    // Query how many ads we actually have now (provider may have returned ads that already existed)
    const { count } = await auth.supabase!
      .from("ads")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", parsed.data.advertiserId);
    
    adsCount = count ?? persisted;
    
    // Re-fetch the competitor record to get the updated name/avatar from syncCompetitorAds
    const { data: updatedCompetitor } = await auth.supabase!
      .from("competitors")
      .select("*")
      .eq("id", competitor.id)
      .single();
    
    // Update sync status to success
    await auth.supabase!
      .from("competitors")
      .update({
        sync_status: "success",
        sync_error: null,
        ads_count: adsCount,
        first_sync_completed_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", competitor.id);
    
    return NextResponse.json({ 
      competitor: { 
        ...(updatedCompetitor || competitor), 
        sync_status: "success",
        ads_count: adsCount
      },
      isNew: true,
      syncStatus: "success",
      adsCount,
      syncError: null
    }, { status: 201 });
    
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Sync failed.";
    console.error(`[CompetitorSync] POST error for ${parsed.data.advertiserId}:`, err);
    
    // Mark as error
    try {
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "error",
          sync_error: syncError,
          ads_count: 0
        })
        .eq("id", competitor.id);
    } catch (updateErr) {
      console.error(`[CompetitorSync] Failed to update error status:`, updateErr);
    }
    
    return NextResponse.json({ 
      competitor: { ...competitor, sync_status: "error", ads_count: 0 },
      isNew: true,
      syncStatus: "error",
      adsCount: 0,
      syncError
    }, { status: 201 });
  }
}

/**
 * PATCH — Competitor actions: refresh, pause, resume
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;
  
  const parsed = z.object({
    id: z.string().uuid(),
    action: z.enum(["refresh", "pause", "resume"]),
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  
  const { id, action } = parsed.data;
  
  // Verify ownership
  const { data: competitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user!.id)
    .single();
  
  if (!competitor) {
    return NextResponse.json({ error: "Competitor not found." }, { status: 404 });
  }
  
  if (action === "pause") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "paused" })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "paused" });
  }
  
  if (action === "resume") {
    await auth.supabase!
      .from("competitors")
      .update({ status: "tracking" })
      .eq("id", id);
    return NextResponse.json({ ok: true, status: "tracking" });
  }
  
  if (action === "refresh") {
    // Prevent concurrent syncs
    if (competitor.sync_status === "syncing") {
      return NextResponse.json({ error: "Sync already in progress." }, { status: 409 });
    }
    
    await auth.supabase!
      .from("competitors")
      .update({ sync_status: "syncing" })
      .eq("id", id);
    
    try {
      const persisted = await syncCompetitorAds(competitor.advertiser_id);
      
      const { count } = await auth.supabase!
        .from("ads")
        .select("*", { count: "exact", head: true })
        .eq("advertiser_id", competitor.advertiser_id);
      
      const adsCount = count ?? Math.max(0, persisted);
      
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "success",
          sync_error: null,
          ads_count: adsCount,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      return NextResponse.json({ ok: true, adsCount, syncStatus: "success" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Refresh failed.";
      await auth.supabase!
        .from("competitors")
        .update({ sync_status: "error", sync_error: errMsg })
        .eq("id", id);
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }
  }
  
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(); if (auth.error) return auth.error;
  const accessError = await requirePaidWorkspaceAccess(); if (accessError) return accessError;
  const id = new URL(request.url).searchParams.get("id");
  const advertiserId = new URL(request.url).searchParams.get("advertiser_id");

  let query = auth.supabase!.from("competitors").delete().eq("user_id", auth.user!.id);
  if (advertiserId) {
    query = query.eq("advertiser_id", advertiserId);
  } else if (id) {
    query = query.eq("id", id);
  } else {
    return NextResponse.json({ error: "Missing id or advertiser_id" }, { status: 400 });
  }

  const { error } = await query;
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}

```

### `lib/ads-persistence.ts`

```typescript
import "server-only";
import type { NormalizedAd } from "@/lib/types";
import { dbAdToNormalized, normalizedToDb } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveMediaFromUrl } from "./media-archiver";
import { integrationConfig } from "@/lib/env/server";

import { realAdvertiserName, resolveAdvertiser } from "@/lib/advertiser-identity";
import { calculateWinnerScore } from "@/lib/intelligence";

export async function persistNormalizedAds(ads: NormalizedAd[]) {
  if (!ads.length || !integrationConfig().supabase) return { persisted: 0, error: null };
  try {
    const admin = createAdminClient();
    const persistableAds = ads.filter(ad => Boolean(
      ad.id && ad.externalId && ad.advertiser.id && ad.advertiser.id !== "unknown" &&
      realAdvertiserName(ad.advertiser.name, ad.advertiser.id)
    ));
    if (persistableAds.length !== ads.length) {
      console.warn(`[Persistence] Skipped ${ads.length - persistableAds.length} ads without canonical advertiser identity.`);
    }
    if (!persistableAds.length) return { persisted: 0, error: "No ads had a canonical advertiser identity." };
    
    // Batch by ad ID as well: an update may omit the advertiser ID entirely.
    const { data: existingRows, error: identityError } = await admin.from("ads").select("*")
      .in("canonical_ad_id", persistableAds.map(ad => ad.id));
    if (identityError) return { persisted: 0, error: "Existing advertiser identity could not be loaded safely." };
    const existingById = new Map((existingRows || []).map(row => [row.canonical_ad_id, dbAdToNormalized(row)]));
    const existingCatalogRows = new Map((existingRows || []).map(row => [row.canonical_ad_id, row]));
    for (const ad of persistableAds) {
      const existing = existingById.get(ad.id);
      if (!existing) continue;
      if (!ad.advertiser.id || ad.advertiser.id === "unknown") ad.advertiser.id = existing.advertiser.id;
      if (ad.advertiser.id === existing.advertiser.id) {
        ad.advertiser = resolveAdvertiser(ad.advertiser, undefined, undefined, existing.advertiser);
      } else if (!ad.advertiser.name) {
        return { persisted: 0, error: "Conflicting advertiser identity on an existing ad." };
      }
    }

    // Group incoming ads by advertiser
    const adsByAdvertiser = new Map<string, NormalizedAd[]>();
    for (const ad of persistableAds) {
      const advId = ad.advertiser.id!;
      if (!adsByAdvertiser.has(advId)) adsByAdvertiser.set(advId, []);
      adsByAdvertiser.get(advId)!.push(ad);
    }

    const allAdsToUpsert: NormalizedAd[] = [];

    // For each advertiser, fetch existing ads to build a complete context
    for (const [advId, incomingAds] of adsByAdvertiser.entries()) {
      // Fetch existing DB ads for this advertiser to build context
      const { data: dbAds } = await admin
        .from("ads")
        .select("*")
        .eq("advertiser_id", advId);
      
      const existingAds: NormalizedAd[] = [];
      if (dbAds && dbAds.length > 0) {
        for (const row of dbAds) {
          try {
            existingCatalogRows.set(row.canonical_ad_id, row);
            existingAds.push(dbAdToNormalized(row));
          } catch {
             // Ignore malformed refined_data
          }
        }
      }

      // Merge incoming with existing, preferring incoming if conflict on ID
      const mergedMap = new Map<string, NormalizedAd>();
      for (const ad of existingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      for (const ad of incomingAds) {
        if (ad && ad.id) mergedMap.set(ad.id, ad);
      }
      
      const fullAdvertiserContext = Array.from(mergedMap.values());

      // Recalculate score for ALL ads (incoming + existing) for this advertiser
      // because a new ad might affect the "Creative Refresh Pattern" of an existing ad, etc.
      for (const ad of fullAdvertiserContext) {
        ad.intelligence.winnerScore = calculateWinnerScore(ad, { advertiserAds: fullAdvertiserContext });
        allAdsToUpsert.push(ad);
      }
    }

    // Now convert all recalculated ads to DB rows and upsert them
    const incomingCanonicalIds = new Set(persistableAds.map(ad => ad.id));
    const rows = allAdsToUpsert.map(ad => {
      const row = normalizedToDb(ad);
      const existing = existingCatalogRows.get(ad.id);
      if (existing) {
        row.provider_ad_ids = [...new Set([...(existing.provider_ad_ids || []), ...(row.provider_ad_ids || [])])];
        row.observation_count = Number(existing.observation_count || 1) + (incomingCanonicalIds.has(ad.id) ? 1 : 0);
      }
      return row;
    });
    
    const validRows = [];
    const invalidRows = [];
    for (const row of rows) {
      if (row.canonical_ad_id && row.advertiser_id && row.raw_data && row.media_type) {
        validRows.push(row);
      } else {
        invalidRows.push({
           id: row.canonical_ad_id,
           hasRawData: !!row.raw_data,
           hasAdvertiserId: !!row.advertiser_id,
           hasMediaType: !!row.media_type
        });
      }
    }

    if (invalidRows.length > 0) {
      console.warn(`[Persistence] Validation failed for ${invalidRows.length} rows:`, JSON.stringify(invalidRows.slice(0, 5)));
    }
    
    // Chunk upserts if necessary, but typically < 1000
    const chunkSize = 500;
    let hasError = false;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const { error } = await admin.from("ads").upsert(chunk, { 
        onConflict: "canonical_ad_id",
        ignoreDuplicates: false 
      });
      if (error) {
        console.error("[Persistence] Chunk upsert error:", error);
        hasError = true;
      }
    }
    
    // Return only the count of the newly provided ads that we actually intended to persist
    return { persisted: persistableAds.length, error: hasError ? "Some chunks failed to persist" : null };
  } catch (error) {
    console.error("Persistence error:", error);
    return { persisted: 0, error: "Normalized ads could not be persisted." };
  }
}

export function adsForClient(ads: NormalizedAd[]) {
  return ads.map(ad => { const clientAd = { ...ad }; return clientAd; });
}

export async function archiveAdsInBackground(ads: NormalizedAd[]) {
  const config = integrationConfig();
  if (!ads.length || !config.supabase || !config.mediaArchival) return;
  const admin = createAdminClient();
  
  
  for (const ad of ads) {
    if (ad.enrichment?.archiveStatus === "archived" || ad.enrichment?.archiveStatus === "unavailable" || ad.enrichment?.archiveStatus === "failed") continue;
    if (!ad.creative?.imageUrl && !ad.creative?.videoUrl && !ad.creative?.carouselItems?.length) continue;
    
    let newSourceUrl = ad.creative.videoUrl || ad.creative.imageUrl;
    let newThumbnailUrl = ad.creative.thumbnailUrl;
    const newCarouselAssets: string[] = [];
    const newCarouselItems: NormalizedAd["creative"]["carouselItems"] = [];
    let storedMediaPath: string | null = null;
    let failed = false;
    
    if (newSourceUrl && !newSourceUrl.includes("supabase.co")) {
      const ext = newSourceUrl.includes(".mp4") ? "mp4" : "webp";
      const path = `${ad.provider.discoveryProvider}/${ad.id}/source.${ext}`;
      const res = await archiveMediaFromUrl(admin, newSourceUrl, path);
      if (res.path) {
         storedMediaPath = res.path;
         newSourceUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      } else {
         failed = true;
      }
    }
    
    if (newThumbnailUrl && !newThumbnailUrl.includes("supabase.co")) {
      const path = `${ad.provider.discoveryProvider}/${ad.id}/thumbnail.webp`
      const res = await archiveMediaFromUrl(admin, newThumbnailUrl, path);
      if (res.path) {
         newThumbnailUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
      }
    }
    
    if (ad.creative.carouselItems && ad.creative.carouselItems.length > 0) {
       for (let i = 0; i < ad.creative.carouselItems.length; i++) {
          const item = ad.creative.carouselItems[i];
          const isVideo = Boolean(item.videoUrl);
          const assetUrl = item.videoUrl || item.imageUrl;
          if (!assetUrl) continue;
          if (assetUrl.includes("supabase.co")) {
             newCarouselAssets.push(assetUrl);
             newCarouselItems.push(item);
             continue;
          }
          const ext = assetUrl.includes(".mp4") ? "mp4" : "webp";
          const path = `${ad.provider.discoveryProvider}/${ad.id}/carousel-${i}.${ext}`;
          const res = await archiveMediaFromUrl(admin, assetUrl, path);
          if (res.path) {
             const archivedUrl = admin.storage.from("ad-creatives").getPublicUrl(res.path).data.publicUrl;
             newCarouselAssets.push(archivedUrl);
             newCarouselItems.push({
               ...item,
               imageUrl: isVideo ? item.imageUrl : archivedUrl,
               videoUrl: isVideo ? archivedUrl : item.videoUrl,
             });
          } else {
             newCarouselAssets.push(assetUrl);
             newCarouselItems.push(item);
          }
       }
    }
    
    const finalStatus = failed ? "failed" : "archived";
    
    const archivedAd: NormalizedAd = {
      ...ad,
      creative: {
        ...ad.creative,
        imageUrl: ad.creative.type === "video" ? ad.creative.imageUrl : newSourceUrl,
        videoUrl: ad.creative.type === "video" ? newSourceUrl : ad.creative.videoUrl,
        thumbnailUrl: newThumbnailUrl,
        carouselItems: newCarouselItems.length ? newCarouselItems : ad.creative.carouselItems,
      },
      enrichment: { ...ad.enrichment, archiveStatus: finalStatus },
    };

    const { error } = await admin.from("ads").update({
      source_media_url: newSourceUrl,
      thumbnail_url: newThumbnailUrl,
      carousel_assets: newCarouselAssets,
      stored_media_path: storedMediaPath,
      refined_data: archivedAd,
      archive_status: finalStatus,
    }).eq("canonical_ad_id", ad.id);
    if (error) console.error("[Persistence] Failed to store archived media references.", error);
  }
}

```

### `lib/billing/entitlement.ts`

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingStatus, EntitlementReason, WorkspaceEntitlement, AccessSource } from "./subscription-state";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isPreviewMode } from "@/lib/preview";
import { isPaymentReviewer } from "./reviewer";
import { isPlatformOwner } from "@/lib/platform-owner";

export async function getWorkspaceEntitlement(workspaceId: string): Promise<WorkspaceEntitlement> {
  const ownerAccess = await isPlatformOwner(workspaceId);
  if (ownerAccess) {
    return {
      hasAccess: true,
      accessSource: "subscription",
      billingStatus: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      nextChargeAt: null,
      legacyGraceEndsAt: null,
      reason: "active_subscription",
    };
  }

  const reviewerAccess = await isPaymentReviewer(workspaceId);
  if (reviewerAccess) {
    return {
        hasAccess: true,
        accessSource: "subscription",
        billingStatus: "active",
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextChargeAt: null,
        legacyGraceEndsAt: null,
        reason: "active_subscription",
    };
  }

  if (isPreviewMode || process.env.NODE_ENV === "development") {
     return {
        hasAccess: true,
        accessSource: "subscription",
        billingStatus: "active",
        trialEndsAt: null,
        currentPeriodEnd: null,
        nextChargeAt: null,
        legacyGraceEndsAt: null,
        reason: "active_subscription",
     };
  }

  if (process.env.EARLY_ACCESS_BYPASS === "true") {
    return {
      hasAccess: true,
      accessSource: "legacy_grace",
      billingStatus: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      nextChargeAt: null,
      legacyGraceEndsAt: null,
      reason: "legacy_grace",
    };
  }
  
  const admin = createAdminClient();
  const [subResponse, grantResponse, earlyAccessResponse] = await Promise.all([
    admin.from("billing_subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("billing_access_grants").select("*").eq("workspace_id", workspaceId).eq("grant_type", "legacy_grace").maybeSingle(),
    admin.from("billing_access_grants").select("*").eq("workspace_id", workspaceId).eq("grant_type", "early_access").maybeSingle(),
  ]);

  const sub = subResponse.data;
  const legacyGrant = grantResponse.data;
  const earlyAccessGrant = earlyAccessResponse.data;

  const now = new Date();
  let hasAccess = false;
  let accessSource: AccessSource = null;
  let reason: EntitlementReason = null;
  
  const localStatus: BillingStatus = sub ? (sub.status as BillingStatus) : "not_started";
  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  
  const legacyGraceEndsAt = legacyGrant?.ends_at ? new Date(legacyGrant.ends_at) : null;
  const isLegacyGraceActive = legacyGraceEndsAt && now < legacyGraceEndsAt;

  if (localStatus === "active") {
    hasAccess = true;
    accessSource = "subscription";
    reason = "active_subscription";
  } else if (localStatus === "trialing" && trialEndsAt && now < trialEndsAt) {
    hasAccess = true;
    accessSource = "trial";
    reason = "trial";
  } else if (localStatus === "cancelled" && currentPeriodEnd && now < currentPeriodEnd) {
    hasAccess = true;
    accessSource = "subscription";
    reason = "active_subscription";
  } else if (earlyAccessGrant && (!earlyAccessGrant.ends_at || now < new Date(earlyAccessGrant.ends_at))) {
    hasAccess = true;
    accessSource = "early_access";
    reason = "early_access";
  } else if (isLegacyGraceActive) {
    hasAccess = true;
    accessSource = "legacy_grace";
    reason = "legacy_grace";
  } else if (localStatus === "past_due" || localStatus === "halted") {
    hasAccess = false;
    reason = "payment_failed";
  } else if (localStatus === "cancelled" && (!currentPeriodEnd || now >= currentPeriodEnd)) {
    hasAccess = false;
    reason = "cancelled";
  } else {
    hasAccess = false;
    reason = "payment_required";
  }

  return {
    hasAccess,
    accessSource,
    billingStatus: localStatus,
    trialEndsAt: sub?.trial_ends_at || null,
    currentPeriodEnd: sub?.current_period_end || null,
    nextChargeAt: sub?.next_charge_at || null,
    legacyGraceEndsAt: legacyGrant?.ends_at || null,
    reason,
  };
}

export async function requirePaidWorkspaceAccess() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const entitlement = await getWorkspaceEntitlement(userId);
  if (!entitlement.hasAccess) {
    return NextResponse.json(
      { error: "Payment required.", reason: entitlement.reason },
      { status: 402 }
    );
  }
  return null; // indicates success, no error response
}

```

### `lib/billing/usage.ts`

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WorkspaceUsage {
  swipeFiles: number;
  sharedAds: number;
  teamMembers: number;
}

export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // For this application architecture, workspaceId acts as the owner_user_id/user_id in these tables
  // Swipe files are grouped by swipe_files table, we want the number of distinct swipe files
  // shared ads are tracked by shared_ad_links where owner_user_id = workspaceId
  
  const [swipeFilesRes, sharedAdsRes] = await Promise.all([
    admin
      .from("swipe_files")
      .select("*", { count: "exact", head: true })
      .eq("user_id", workspaceId)
      // exclude default swipe file which might be system generated
      .neq("is_default", true),
    admin
      .from("shared_ad_links")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", workspaceId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
  ]);

  // For team members, in the current simple Clerk implementation for Scout, it's 1. 
  // If Clerk Organizations are used, we'd query Clerk. For now, since team invites are not fully active for Scout,
  // we default to 1 for the owner, unless we fetch from Clerk orgs.
  // We'll hardcode 1 for now and rely on Clerk if organizations exist.
  // To avoid adding clerk-sdk calls unnecessarily if not in org context, we just return 1.
  const teamMembers = 1;
  // if (workspaceId.startsWith('org_')) {
  //    teamMembers = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: workspaceId }).then(res => res.totalCount);
  // }

  return {
    swipeFiles: swipeFilesRes.count ?? 0,
    sharedAds: sharedAdsRes.count ?? 0,
    teamMembers,
  };
}

export const CREDIT_COSTS = {
  AD_SEARCH: 15,
  BRAND_SEARCH: 15,
  AD_DELIVERED: 10,
};

export interface WorkspaceCreditBalance {
  unlimited: boolean;
  creditsAllocated: number | null;
  creditsUsed: number | null;
  creditsRemaining: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
}

import { isPlatformOwner } from "@/lib/platform-owner";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";

export async function getWorkspaceCreditBalance(workspaceId: string): Promise<WorkspaceCreditBalance | null> {
  const isOwner = await isPlatformOwner(workspaceId);
  if (isOwner) {
    return {
      unlimited: true,
      creditsAllocated: null,
      creditsUsed: null,
      creditsRemaining: null,
      cycleStart: null,
      cycleEnd: null,
    };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("workspace_credit_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gt("cycle_end", now)
    .order("cycle_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const entitlement = await getWorkspaceEntitlement(workspaceId);
    if (!entitlement.hasAccess) return null;

    if (entitlement.accessSource === "early_access") {
      // Reconcile missing early access balance row using original successful payment
      const { data: payment } = await admin
        .from("billing_payments")
        .select("id, provider, provider_order_id, provider_payment_id, paid_at")
        .eq("workspace_id", workspaceId)
        .eq("payment_type", "early_access")
        .eq("status", "paid")
        .maybeSingle();

      if (payment && payment.provider_order_id && payment.provider_payment_id) {
        const { data: reconciled, error: reconError } = await admin.rpc("finalize_early_access_purchase", {
          p_workspace_id: workspaceId,
          p_provider: payment.provider,
          p_order_id: payment.provider_order_id,
          p_payment_id: payment.provider_payment_id,
          p_paid_at: payment.paid_at || now,
        });

        if (!reconError && reconciled) {
          // Fetch the newly reconciled balance
          const { data: newBalance } = await admin
            .from("workspace_credit_balances")
            .select("*")
            .eq("workspace_id", workspaceId)
            .gt("cycle_end", now)
            .order("cycle_start", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (newBalance) {
             return {
              unlimited: false,
              creditsAllocated: Number(newBalance.credits_allocated),
              creditsUsed: Number(newBalance.credits_used),
              creditsRemaining: Math.max(0, Number(newBalance.credits_allocated) - Number(newBalance.credits_used)),
              cycleStart: newBalance.cycle_start,
              cycleEnd: newBalance.cycle_end,
            };
          }
        }
      }
      
      // If we reach here, we know they have early_access entitlement but the ledger cannot prove it.
      // Do NOT silently return 0 used / 3000 allocated.
      console.error(`[Billing] Missing credit balance row for paid workspace ${workspaceId}. Reconciliation failed.`);
      return null;
    }
    
    // Non-early-access paid plans without a balance row.
    // In the future this handles subscriptions. For now we return null.
    return null;
  }

  const creditsRemaining = Math.max(0, Number(data.credits_allocated) - Number(data.credits_used));

  return {
    unlimited: false,
    creditsAllocated: Number(data.credits_allocated),
    creditsUsed: Number(data.credits_used),
    creditsRemaining,
    cycleStart: data.cycle_start,
    cycleEnd: data.cycle_end,
  };
}

export async function consumeUsage(
  workspaceId: string,
  userId: string,
  sessionId: string,
  baseEventType: "AD_SEARCH" | "BRAND_SEARCH" | null,
  baseFingerprint: string | null,
  baseCost: number,
  deliveryEventType: "AD_DELIVERED" | null,
  deliveryAdIds: string[],
  deliveryCostPerAd: number
) {
  const isOwner = await isPlatformOwner(workspaceId);
  if (isOwner) {
    return { 
      success: true, 
      unlimited: true, 
      baseCharged: false,
      creditsChargedThisRequest: 0, 
      acceptedAdIds: deliveryAdIds,
      creditsRemaining: null,
      creditsAllocated: null,
      creditsUsed: null,
      exhausted: false 
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("report_search_and_delivery_usage", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_search_session_id: sessionId,
    p_base_event_type: baseEventType,
    p_base_fingerprint: baseFingerprint,
    p_base_cost: baseCost,
    p_delivery_event_type: deliveryEventType,
    p_delivery_ad_ids: deliveryAdIds,
    p_delivery_cost: deliveryCostPerAd,
    p_metadata: {}
  });

  if (error) {
    console.error("[Usage] RPC error consuming credits:", error);
    return { success: false, error: "RPC_ERROR" };
  }
  
  return { ...data, unlimited: false };
}

```

### `lib/billing/billing-config.ts`

```typescript
export type PlanConfig = {
  id: "early_access" | "scout" | "hunter" | "agency";
  name: string;
  audience: string;
  regularPrice?: number | null;
  currentPrice?: number | null;
  priceLabel?: string;
  status: "available" | "coming_soon";
  features: string[];
  limits: {
    teamMembers: number | "unlimited";
    swipeFiles: number | "unlimited";
    sharedAds: number | "unlimited";
  };
};

export const BILLING_CONFIG: Record<string, PlanConfig> = {
  scout: {
    id: "scout",
    name: "Scout",
    audience: "For individual marketers and creative researchers.",
    regularPrice: 2499,
    currentPrice: 499,
    status: "available",
    features: [
      "Discover our ads",
      "Search & Filters",
      "Ad Details",
      "Brand Research",
      "Swipe Files",
      "Shared Ads",
    ],
    limits: {
      teamMembers: 1,
      swipeFiles: 5,
      sharedAds: 10,
    }
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    audience: "For growing marketing and creative teams.",
    regularPrice: null,
    currentPrice: null,
    priceLabel: "Pricing to be announced",
    status: "coming_soon",
    features: ["Built for growing team workflows.", "Plan details coming soon."],
    limits: {
      teamMembers: 5,
      swipeFiles: "unlimited",
      sharedAds: "unlimited",
    }
  },
  agency: {
    id: "agency",
    name: "Agency",
    audience: "For agencies and larger creative research teams.",
    regularPrice: null,
    currentPrice: null,
    priceLabel: "Pricing to be announced",
    status: "coming_soon",
    features: ["Designed for larger agency research workflows.", "Plan details coming soon."],
    limits: {
      teamMembers: 20,
      swipeFiles: "unlimited",
      sharedAds: "unlimited",
    }
  },
} as const;

export const EARLY_ACCESS_PLAN_CONFIG: PlanConfig = {
  id: "early_access",
  name: "Early Access",
  audience: "One-time access while subscription checkout is being finalized.",
  currentPrice: 588.82,
  status: "available",
  features: [
    "Search & Discover Ads",
    "Ad Intelligence",
    "Winner Score",
    "Swipe Files",
    "Brand Research",
    "3,000 Early Access Credits",
  ],
  limits: {
    teamMembers: 1,
    swipeFiles: 5,
    sharedAds: 10,
  },
};

export type PlanKey = keyof typeof BILLING_CONFIG;

// Legacy mapping layer
export const LEGACY_PLAN_MAP: Record<string, keyof typeof BILLING_CONFIG> = {
  pro: "scout",
  ads_hunting_pro: "scout",
  basic: "scout",
};

export function resolvePlanKey(rawKey?: string | null): PlanKey | null {
  if (!rawKey) return null;
  const mapped = LEGACY_PLAN_MAP[rawKey.toLowerCase()];
  if (mapped) return mapped;
  if (BILLING_CONFIG[rawKey as PlanKey]) return rawKey as PlanKey;
  return null;
}

```

### `app/(workspace)/settings/team/actions.ts`

```typescript
"use server";

import { requireUser } from "@/lib/auth";
import { getWorkspaceEntitlement } from "@/lib/billing/entitlement";
import { getWorkspaceUsage } from "@/lib/billing/usage";
import { resolveWorkspaceAccess } from "@/lib/billing/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePlanKey } from "@/lib/billing/billing-config";

export async function inviteTeamMember(email: string) {
  const { userId } = await requireUser();
  if (!userId) {
    return { error: "Authentication required" };
  }

  // 1. Get entitlement and subscription
  const entitlement = await getWorkspaceEntitlement(userId);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("plan_key")
    .eq("workspace_id", userId)
    .maybeSingle();

  const planKey = resolvePlanKey(sub?.plan_key as string);
  
  // 2. Resolve access limits
  const planLimits = resolveWorkspaceAccess(entitlement, planKey || "scout");
  
  // 3. Enforce Invite Capability
  if (!planLimits.canInviteMembers) {
    return { error: "Your current plan does not support team invitations. Please upgrade to Hunter or Agency." };
  }

  // 4. Enforce Seat Limit
  if (planLimits.teamMembers !== "unlimited") {
    const usage = await getWorkspaceUsage(userId);
    if (usage.teamMembers >= planLimits.teamMembers) {
      return { error: `Seat limit reached (${usage.teamMembers}/${planLimits.teamMembers}). Please upgrade your plan for more seats.` };
    }
  }

  // If we had a real team members table or Clerk Organizations setup, we would insert/invite here.
  // For now, return success to simulate the backend action working correctly.
  
  // Simulate network
  await new Promise(resolve => setTimeout(resolve, 800));

  return { success: true, message: `Invitation sent to ${email}` };
}

```

### `supabase/functions/_shared/ads/providers/metaapiio.ts`

```typescript
import type { AdProvider, AdSearchFilters, AdSearchResult, ProviderCapabilities } from "../types.ts";
import { ProviderError } from "./errors.ts";

export class MetaApiIoProvider implements AdProvider {
  readonly name = "metaapi_io";
  
  readonly capabilities: ProviderCapabilities = {
    keywordSearch: true, advertiserSearch: true, commercialAds: true,
    pagination: true, demographics: false, copy: true, landingPage: true,
    formats: "NATIVE",
    statuses: "NATIVE",
    markets: "NATIVE",
    languages: "NATIVE",
    niches: "UNSUPPORTED",
    contentStyles: "UNSUPPORTED",
    runtime: "POST_FILTER",
    videoLength: "UNSUPPORTED",
  };

  private apiKey: string | undefined;

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async searchAds(_filters: AdSearchFilters): Promise<AdSearchResult> {
    if (!this.isConfigured()) {
      throw new ProviderError("PROVIDER_NOT_CONFIGURED", "MetaAPI.io is not configured.", 503);
    }
    
    // TODO: Implement the real MetaAPI.io integration here once the 
    // exact endpoint, parameters, auth format, pagination, and response schema 
    // are provided.
    // 
    // For now, this is cleanly isolated and will safely fail over.
    // We are NOT mocking fake data or guessing the schema.
    throw new ProviderError("UPSTREAM", "MetaAPI.io adapter is not yet implemented.", 501, false);
  }
}

```

## 3. Live Test, Typecheck & Lint Baseline (Exact Terminal Output)

### 1. `npm run typecheck`

```bash
$ npm run typecheck
npm notice run adshunting@1.0.0 typecheck
npm notice run tsc --noEmit
```

### 2. `npm run lint`

```bash
$ npm run lint
npm notice run adshunting@1.0.0 lint
npm notice run eslint . --max-warnings=0

/Users/rahulg/adsHunting 2/app/api/ads/search/route.ts
  1:10  warning  'requirePaidWorkspaceAccess' is defined but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/app/api/search/route.ts
  511:60  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  533:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  554:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/rahulg/adsHunting 2/components/ad-detail.tsx
   15:43  warning  'sanitizeAdCopy' is defined but never used       @typescript-eslint/no-unused-vars
  167:9   warning  'scoreTheme' is assigned a value but never used  @typescript-eslint/no-unused-vars
  542:9   warning  'labels' is assigned a value but never used      @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/components/auth/animated-product-canvas.tsx
  5:22  warning  'BarChart3' is defined but never used  @typescript-eslint/no-unused-vars
  5:45  warning  'Layers' is defined but never used     @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/lib/__tests__/intelligence.test.ts
  6:3  warning  'calculateVariantScore' is defined but never used                 @typescript-eslint/no-unused-vars
  8:3  warning  'calculateLandingPagePersistenceScore' is defined but never used  @typescript-eslint/no-unused-vars
  9:3  warning  'calculateCreativeRefreshPatternScore' is defined but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/lib/auth-session.ts
  29:13  warning  'clientAuth' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/lib/auth.ts
  5:10  warning  'createClerkSupabaseServerClient' is defined but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/scripts/fix-brands.ts
  26:34  error    Unexpected any. Specify a different type      @typescript-eslint/no-explicit-any
  37:45  error    Unexpected any. Specify a different type      @typescript-eslint/no-explicit-any
  44:45  error    Unexpected any. Specify a different type      @typescript-eslint/no-explicit-any
  53:31  warning  'compErr' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/scripts/measure-swipe.ts
  43:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/rahulg/adsHunting 2/scripts/test-search-quality.js
  11:14  error  Parsing error: Invalid character

/Users/rahulg/adsHunting 2/scripts/verify-advertiser-live.cjs
   3:1   error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
   4:1   error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
   5:16  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  11:26  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  12:30  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  13:47  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  14:51  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  15:34  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  16:34  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  17:15  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  18:20  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  19:16  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  20:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/supabase/functions/_shared/ads/providers/metaapiio.ts
  30:19  warning  '_filters' is defined but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/test-cashfree.js
  1:15  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test-db-insert.js
   1:26  error    A `require()` style import is forbidden             @typescript-eslint/no-require-imports
  16:17  warning  'createdIntent' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/test-edge.js
  1:26  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  2:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test-env.js
  1:1  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test-rpc.js
  1:26  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  2:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test-search-reliability.js
  1:9   warning  'execSync' is assigned a value but never used  @typescript-eslint/no-unused-vars
  1:22  error    A `require()` style import is forbidden        @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test-suggestions.js
  1:7   warning  'http' is assigned a value but never used  @typescript-eslint/no-unused-vars
  1:14  error    A `require()` style import is forbidden    @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/test_brand.ts
  1:10  warning  'getBrands' is defined but never used  @typescript-eslint/no-unused-vars

/Users/rahulg/adsHunting 2/tests/advertiser-identity.test.ts
  91:46  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  92:54  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/rahulg/adsHunting 2/tests/contract.test.ts
  32:71   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  32:115  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  33:71   error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  33:115  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/rahulg/adsHunting 2/tests/register-typescript.cjs
  2:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  3:16  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  4:14  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  5:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

✖ 57 problems (40 errors, 17 warnings)
```

### 3. `node --require ./tests/register-typescript.cjs --test tests/*.test.ts`

```bash
$ node --require ./tests/register-typescript.cjs --test tests/*.test.ts
TAP version 13
# Subtest: resolution order, matched context, mismatches, keyword safety and unknown UI fallback
ok 1 - resolution order, matched context, mismatches, keyword safety and unknown UI fallback
  ---
  duration_ms: 2.450167
  type: 'test'
  ...
# Subtest: identity survives persistence, cached JSON, refinement and URL refresh; empty updates preserve name
ok 2 - identity survives persistence, cached JSON, refinement and URL refresh; empty updates preserve name
  ---
  duration_ms: 0.969959
  type: 'test'
  ...
# Subtest: Meta request asks for identity and scopes by page ID, preserving raw evidence
ok 3 - Meta request asks for identity and scopes by page ID, preserving raw evidence
  ---
  duration_ms: 15.736667
  type: 'test'
  ...
# Subtest: Foreplay brand endpoint and matching brand ID are mandatory; provider name wins
ok 4 - Foreplay brand endpoint and matching brand ID are mandatory; provider name wins
  ---
  duration_ms: 0.863125
  type: 'test'
  ...
# Subtest: edge Meta and Foreplay adapters enforce scoped identity without generic fallback
ok 5 - edge Meta and Foreplay adapters enforce scoped identity without generic fallback
  ---
  duration_ms: 31.877167
  type: 'test'
  ...
# Subtest: Discover has no brand-specific ranking hardcode and DB query is scoped
ok 6 - Discover has no brand-specific ranking hardcode and DB query is scoped
  ---
  duration_ms: 0.177291
  type: 'test'
  ...
# Subtest: Contract: refineAd handles undefined delivery safely
ok 7 - Contract: refineAd handles undefined delivery safely
  ---
  duration_ms: 2.173333
  type: 'test'
  ...
# Subtest: Contract: refineAd handles undefined creative safely
ok 8 - Contract: refineAd handles undefined creative safely
  ---
  duration_ms: 0.083833
  type: 'test'
  ...
# Subtest: Contract: refineAd handles missing advertiser metadata
ok 9 - Contract: refineAd handles missing advertiser metadata
  ---
  duration_ms: 0.093708
  type: 'test'
  ...
# Subtest: Contract: duplicate canonical ads generate stable IDs
ok 10 - Contract: duplicate canonical ads generate stable IDs
  ---
  duration_ms: 0.853791
  type: 'test'
  ...
# Subtest: Contract: creative variants sharing a provider ad ID remain distinct
ok 11 - Contract: creative variants sharing a provider ad ID remain distinct
  ---
  duration_ms: 0.382417
  type: 'test'
  ...
# Subtest: Contract: edge provider chain is configurable and falls through empty results
ok 12 - Contract: edge provider chain is configurable and falls through empty results
  ---
  duration_ms: 0.162208
  type: 'test'
  ...
# (node:8107) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/rahulg/adsHunting%202/tests/early-access.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Users/rahulg/adsHunting 2/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: Early Access price and credit constants are exact and decimal-safe
ok 13 - Early Access price and credit constants are exact and decimal-safe
  ---
  duration_ms: 8.797583
  type: 'test'
  ...
# Subtest: Cashfree order creation uses server constants and mandatory One Click Checkout
not ok 14 - Cashfree order creation uses server constants and mandatory One Click Checkout
  ---
  duration_ms: 1.05625
  type: 'test'
  location: '/Users/rahulg/adsHunting 2/tests/early-access.test.ts:34:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /CASHFREE_API_VERSION = "2026-01-01"/. Input:
    
    'export const CASHFREE_API_VERSION = "2023-08-01";\n' +
      '\n' +
      'declare const Deno: { env: { get(key: string): string | undefined } };\n' +
      '\n' +
      'export type CashfreeEnvironment = "sandbox" | "production";\n' +
      '\n' +
      'export type CashfreeOrder = {\n' +
      '  cf_order_id: string;\n' +
      '  order_id: string;\n' +
      '  order_amount: number;\n' +
      '  order_currency: string;\n' +
      '  order_status: string;\n' +
      '  payment_session_id?: string;\n' +
      '  customer_details?: {\n' +
      '    customer_id?: string;\n' +
      '    customer_email?: string;\n' +
      '    customer_phone?: string;\n' +
      '    customer_name?: string;\n' +
      '  };\n' +
      '  order_tags?: Record<string, string> | null;\n' +
      '};\n' +
      '\n' +
      'export type CashfreePayment = {\n' +
      '  cf_payment_id: string | number;\n' +
      '  order_id: string;\n' +
      '  order_amount: number;\n' +
      '  order_currency: string;\n' +
      '  payment_amount: number;\n' +
      '  payment_currency: string;\n' +
      '  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";\n' +
      '  payment_time?: string;\n' +
      '  payment_completion_time?: string;\n' +
      '};\n' +
      '\n' +
      'export type CashfreeEarlyAccessEvidence = {\n' +
      '  state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";\n' +
      '  paymentId: string | null;\n' +
      '  paidAt: string | null;\n' +
      '};\n' +
      '\n' +
      'type CashfreeConfig = {\n' +
      '  appId: string;\n' +
      '  secretKey: string;\n' +
      '  environment: CashfreeEnvironment;\n' +
      '  baseUrl: string;\n' +
      '};\n' +
      '\n' +
      'export class CashfreeApiError extends Error {\n' +
      '  readonly status: number;\n' +
      '  readonly code: string | null;\n' +
      '  readonly errorType: string | null;\n' +
      '  readonly requestId: string;\n' +
      '\n' +
      '  constructor(\n' +
      '    message: string,\n' +
      '    status: number,\n' +
      '    code: string | null,\n' +
      '    errorType: string | null,\n' +
      '    requestId: string,\n' +
      '  ) {\n' +
      '    super(message);\n' +
      '    this.name = "CashfreeApiError";\n' +
      '    this.status = status;\n' +
      '    this.code = code;\n' +
      '    this.errorType = errorType;\n' +
      '    this.requestId = requestId;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'export function getCashfreeConfig(): CashfreeConfig {\n' +
      '  const appId = Deno.env.get("CASHFREE_APP_ID");\n' +
      '  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");\n' +
      '  let environment = Deno.env.get("CASHFREE_ENV") as CashfreeEnvironment | undefined;\n' +
      '  \n' +
      '  if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");\n' +
      '  \n' +
      "  // Auto-detect environment if it's mismatched or missing, since Sandbox IDs always start with TEST\n" +
      '  const detectedEnv = appId.startsWith("TEST") ? "sandbox" : "production";\n' +
      '  if (environment !== detectedEnv) {\n' +
      '    console.log(`[Cashfree Config] Auto-correcting environment to ${detectedEnv} based on App ID prefix.`);\n' +
      '    environment = detectedEnv;\n' +
      '  }\n' +
      '\n' +
      '  return {\n' +
      '    appId,\n' +
      '    secretKey,\n' +
      '    environment,\n' +
      '    baseUrl: environment === "sandbox"\n' +
      '      ? "https://sandbox.cashfree.com/pg"\n' +
      '      : "https://api.cashfree.com/pg",\n' +
      '  };\n' +
      '}\n' +
      '\n' +
      'async function cashfreeRequest<T>(\n' +
      '  path: string,\n' +
      '  requestId: string,\n' +
      '  init: RequestInit = {},\n' +
      '  idempotencyKey?: string,\n' +
      '): Promise<T> {\n' +
      '  const config = getCashfreeConfig();\n' +
      '  const controller = new AbortController();\n' +
      '  const timeout = setTimeout(() => controller.abort(), 12_000);\n' +
      '  try {\n' +
      '    const response = await fetch(`${config.baseUrl}${path}`, {\n' +
      '      ...init,\n' +
      '      signal: controller.signal,\n' +
      '      headers: {\n' +
      '        Accept: "application/json",\n' +
      '        "Content-Type": "application/json",\n' +
      '        "x-api-version": CASHFREE_API_VERSION,\n' +
      '        "x-client-id": config.appId,\n' +
      '        "x-client-secret": config.secretKey,\n' +
      '        "x-request-id": requestId,\n' +
      '        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),\n' +
      '        ...init.headers,\n' +
      '      },\n' +
      '    });\n' +
      '    const data = await response.json().catch(() => null) as Record<string, unknown> | null;\n' +
      '    if (!response.ok) {\n' +
      '      throw new CashfreeApiError(\n' +
      '        typeof data?.message === "string" ? data.message : "Cashfree request failed.",\n' +
      '        response.status,\n' +
      '        typeof data?.code === "string" ? data.code : null,\n' +
      '        typeof data?.type === "string" ? data.type : null,\n' +
      '        requestId,\n' +
      '      );\n' +
      '    }\n' +
      '    return data as T;\n' +
      '  } catch (error: unknown) {\n' +
      '    if (error instanceof CashfreeApiError) throw error;\n' +
      '    const message = error instanceof DOMException && error.name === "AbortError"\n' +
      '      ? "Cashfree request timed out."\n' +
      '      : "Unable to reach Cashfree.";\n' +
      '    throw new CashfreeApiError(message, 0, null, "network_error", requestId);\n' +
      '  } finally {\n' +
      '    clearTimeout(timeout);\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'export function createCashfreeOrder(\n' +
      '  payload: Record<string, unknown>,\n' +
      '  requestId: string,\n' +
      '  idempotencyKey: string,\n' +
      ') {\n' +
      '  return cashfreeRequest<CashfreeOrder>(\n' +
      '    "/orders",\n' +
      '    requestId,\n' +
      '    { method: "POST", body: JSON.stringify(payload) },\n' +
      '    idempotencyKey,\n' +
      '  );\n' +
      '}\n' +
      '\n' +
      'export function getCashfreeOrder(orderId: string, requestId: string) {\n' +
      '  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);\n' +
      '}\n' +
      '\n' +
      'export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {\n' +
      '  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);\n' +
      '}\n' +
      '\n' +
      'export function validateCashfreeEarlyAccessEvidence(\n' +
      '  order: CashfreeOrder,\n' +
      '  payments: CashfreePayment[],\n' +
      '  expected: {\n' +
      '    orderId: string;\n' +
      '    workspaceId: string;\n' +
      '    internalPaymentId: string;\n' +
      '    amountPaise: number;\n' +
      '    currency: string;\n' +
      '    paymentType: string;\n' +
      '  },\n' +
      '  amountToPaise: (value: string | number) => number | null,\n' +
      '): CashfreeEarlyAccessEvidence {\n' +
      '  if (\n' +
      '    order.order_id !== expected.orderId\n' +
      '    || amountToPaise(order.order_amount) !== expected.amountPaise\n' +
      '    || order.order_currency !== expected.currency\n' +
      '    || order.customer_details?.customer_id !== expected.workspaceId\n' +
      '    || order.order_tags?.product !== expected.paymentType\n' +
      '    || order.order_tags?.workspace_id !== expected.workspaceId\n' +
      '    || order.order_tags?.internal_payment_id !== expected.internalPaymentId\n' +
      '  ) {\n' +
      '    throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");\n' +
      '  }\n' +
      '\n' +
      '  const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");\n' +
      '  const successfulPayment = successfulPayments.find((payment) => (\n' +
      '    payment.order_id === expected.orderId\n' +
      '    && amountToPaise(payment.order_amount) === expected.amountPaise\n' +
      '    && payment.payment_currency === expected.currency\n' +
      '  ));\n' +
      '  if (successfulPayments.length > 0 && !successfulPayment) {\n' +
      '    throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");\n' +
      '  }\n' +
      '  if (order.order_status === "PAID" && successfulPayment) {\n' +
      '    return {\n' +
      '      state: "paid",\n' +
      '      paymentId: String(successfulPayment.cf_payment_id),\n' +
      '      paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),\n' +
      '    };\n' +
      '  }\n' +
      '\n' +
      '  const statuses = new Set(payments.map((payment) => payment.payment_status));\n' +
      '  if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {\n' +
      '    return { state: "pending", paymentId: null, paidAt: null };\n' +
      '  }\n' +
      '  if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };\n' +
      '  return { state: "pending", paymentId: null, paidAt: null };\n' +
      '}\n' +
      '\n' +
      'export async function verifyCashfreeWebhookSignature(\n' +
      '  rawBody: string,\n' +
      '  timestamp: string,\n' +
      '  signature: string,\n' +
      ') {\n' +
      '  const { secretKey } = getCashfreeConfig();\n' +
      '  let supplied: Uint8Array<ArrayBuffer>;\n' +
      '  try {\n' +
      '    supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));\n' +
      '  } catch {\n' +
      '    return false;\n' +
      '  }\n' +
      '\n' +
      '  const encoder = new TextEncoder();\n' +
      '  const key = await crypto.subtle.importKey(\n' +
      '    "raw",\n' +
      '    encoder.encode(secretKey),\n' +
      '    { name: "HMAC", hash: "SHA-256" },\n' +
      '    false,\n' +
      '    ["verify"],\n' +
      '  );\n' +
      '  return crypto.subtle.verify(\n' +
      '    "HMAC",\n' +
      '    key,\n' +
      '    supplied,\n' +
      '    encoder.encode(`${timestamp}${rawBody}`),\n' +
      '  );\n' +
      '}\n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    export const CASHFREE_API_VERSION = "2023-08-01";
    
    declare const Deno: { env: { get(key: string): string | undefined } };
    
    export type CashfreeEnvironment = "sandbox" | "production";
    
    export type CashfreeOrder = {
      cf_order_id: string;
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
      payment_session_id?: string;
      customer_details?: {
        customer_id?: string;
        customer_email?: string;
        customer_phone?: string;
        customer_name?: string;
      };
      order_tags?: Record<string, string> | null;
    };
    
    export type CashfreePayment = {
      cf_payment_id: string | number;
      order_id: string;
      order_amount: number;
      order_currency: string;
      payment_amount: number;
      payment_currency: string;
      payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
      payment_time?: string;
      payment_completion_time?: string;
    };
    
    export type CashfreeEarlyAccessEvidence = {
      state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";
      paymentId: string | null;
      paidAt: string | null;
    };
    
    type CashfreeConfig = {
      appId: string;
      secretKey: string;
      environment: CashfreeEnvironment;
      baseUrl: string;
    };
    
    export class CashfreeApiError extends Error {
      readonly status: number;
      readonly code: string | null;
      readonly errorType: string | null;
      readonly requestId: string;
    
      constructor(
        message: string,
        status: number,
        code: string | null,
        errorType: string | null,
        requestId: string,
      ) {
        super(message);
        this.name = "CashfreeApiError";
        this.status = status;
        this.code = code;
        this.errorType = errorType;
        this.requestId = requestId;
      }
    }
    
    export function getCashfreeConfig(): CashfreeConfig {
      const appId = Deno.env.get("CASHFREE_APP_ID");
      const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
      let environment = Deno.env.get("CASHFREE_ENV") as CashfreeEnvironment | undefined;
      
      if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");
      
      // Auto-detect environment if it's mismatched or missing, since Sandbox IDs always start with TEST
      const detectedEnv = appId.startsWith("TEST") ? "sandbox" : "production";
      if (environment !== detectedEnv) {
        console.log(`[Cashfree Config] Auto-correcting environment to ${detectedEnv} based on App ID prefix.`);
        environment = detectedEnv;
      }
    
      return {
        appId,
        secretKey,
        environment,
        baseUrl: environment === "sandbox"
          ? "https://sandbox.cashfree.com/pg"
          : "https://api.cashfree.com/pg",
      };
    }
    
    async function cashfreeRequest<T>(
      path: string,
      requestId: string,
      init: RequestInit = {},
      idempotencyKey?: string,
    ): Promise<T> {
      const config = getCashfreeConfig();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(`${config.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-version": CASHFREE_API_VERSION,
            "x-client-id": config.appId,
            "x-client-secret": config.secretKey,
            "x-request-id": requestId,
            ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
            ...init.headers,
          },
        });
        const data = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) {
          throw new CashfreeApiError(
            typeof data?.message === "string" ? data.message : "Cashfree request failed.",
            response.status,
            typeof data?.code === "string" ? data.code : null,
            typeof data?.type === "string" ? data.type : null,
            requestId,
          );
        }
        return data as T;
      } catch (error: unknown) {
        if (error instanceof CashfreeApiError) throw error;
        const message = error instanceof DOMException && error.name === "AbortError"
          ? "Cashfree request timed out."
          : "Unable to reach Cashfree.";
        throw new CashfreeApiError(message, 0, null, "network_error", requestId);
      } finally {
        clearTimeout(timeout);
      }
    }
    
    export function createCashfreeOrder(
      payload: Record<string, unknown>,
      requestId: string,
      idempotencyKey: string,
    ) {
      return cashfreeRequest<CashfreeOrder>(
        "/orders",
        requestId,
        { method: "POST", body: JSON.stringify(payload) },
        idempotencyKey,
      );
    }
    
    export function getCashfreeOrder(orderId: string, requestId: string) {
      return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);
    }
    
    export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {
      return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);
    }
    
    export function validateCashfreeEarlyAccessEvidence(
      order: CashfreeOrder,
      payments: CashfreePayment[],
      expected: {
        orderId: string;
        workspaceId: string;
        internalPaymentId: string;
        amountPaise: number;
        currency: string;
        paymentType: string;
      },
      amountToPaise: (value: string | number) => number | null,
    ): CashfreeEarlyAccessEvidence {
      if (
        order.order_id !== expected.orderId
        || amountToPaise(order.order_amount) !== expected.amountPaise
        || order.order_currency !== expected.currency
        || order.customer_details?.customer_id !== expected.workspaceId
        || order.order_tags?.product !== expected.paymentType
        || order.order_tags?.workspace_id !== expected.workspaceId
        || order.order_tags?.internal_payment_id !== expected.internalPaymentId
      ) {
        throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");
      }
    
      const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");
      const successfulPayment = successfulPayments.find((payment) => (
        payment.order_id === expected.orderId
        && amountToPaise(payment.order_amount) === expected.amountPaise
        && payment.payment_currency === expected.currency
      ));
      if (successfulPayments.length > 0 && !successfulPayment) {
        throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");
      }
      if (order.order_status === "PAID" && successfulPayment) {
        return {
          state: "paid",
          paymentId: String(successfulPayment.cf_payment_id),
          paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),
        };
      }
    
      const statuses = new Set(payments.map((payment) => payment.payment_status));
      if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {
        return { state: "pending", paymentId: null, paidAt: null };
      }
      if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };
      if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };
      if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };
      if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };
      return { state: "pending", paymentId: null, paidAt: null };
    }
    
    export async function verifyCashfreeWebhookSignature(
      rawBody: string,
      timestamp: string,
      signature: string,
    ) {
      const { secretKey } = getCashfreeConfig();
      let supplied: Uint8Array<ArrayBuffer>;
      try {
        supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
      } catch {
        return false;
      }
    
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      return crypto.subtle.verify(
        "HMAC",
        key,
        supplied,
        encoder.encode(`${timestamp}${rawBody}`),
      );
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///Users/rahulg/adsHunting%202/tests/early-access.test.ts:35:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: server verification requires authenticated ownership and authoritative Cashfree evidence
not ok 15 - server verification requires authenticated ownership and authoritative Cashfree evidence
  ---
  duration_ms: 0.316042
  type: 'test'
  location: '/Users/rahulg/adsHunting 2/tests/early-access.test.ts:46:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /amountToPaise\(payment\.payment_amount\) === expected\.amountPaise/. Input:
    
    'export const CASHFREE_API_VERSION = "2023-08-01";\n' +
      '\n' +
      'declare const Deno: { env: { get(key: string): string | undefined } };\n' +
      '\n' +
      'export type CashfreeEnvironment = "sandbox" | "production";\n' +
      '\n' +
      'export type CashfreeOrder = {\n' +
      '  cf_order_id: string;\n' +
      '  order_id: string;\n' +
      '  order_amount: number;\n' +
      '  order_currency: string;\n' +
      '  order_status: string;\n' +
      '  payment_session_id?: string;\n' +
      '  customer_details?: {\n' +
      '    customer_id?: string;\n' +
      '    customer_email?: string;\n' +
      '    customer_phone?: string;\n' +
      '    customer_name?: string;\n' +
      '  };\n' +
      '  order_tags?: Record<string, string> | null;\n' +
      '};\n' +
      '\n' +
      'export type CashfreePayment = {\n' +
      '  cf_payment_id: string | number;\n' +
      '  order_id: string;\n' +
      '  order_amount: number;\n' +
      '  order_currency: string;\n' +
      '  payment_amount: number;\n' +
      '  payment_currency: string;\n' +
      '  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";\n' +
      '  payment_time?: string;\n' +
      '  payment_completion_time?: string;\n' +
      '};\n' +
      '\n' +
      'export type CashfreeEarlyAccessEvidence = {\n' +
      '  state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";\n' +
      '  paymentId: string | null;\n' +
      '  paidAt: string | null;\n' +
      '};\n' +
      '\n' +
      'type CashfreeConfig = {\n' +
      '  appId: string;\n' +
      '  secretKey: string;\n' +
      '  environment: CashfreeEnvironment;\n' +
      '  baseUrl: string;\n' +
      '};\n' +
      '\n' +
      'export class CashfreeApiError extends Error {\n' +
      '  readonly status: number;\n' +
      '  readonly code: string | null;\n' +
      '  readonly errorType: string | null;\n' +
      '  readonly requestId: string;\n' +
      '\n' +
      '  constructor(\n' +
      '    message: string,\n' +
      '    status: number,\n' +
      '    code: string | null,\n' +
      '    errorType: string | null,\n' +
      '    requestId: string,\n' +
      '  ) {\n' +
      '    super(message);\n' +
      '    this.name = "CashfreeApiError";\n' +
      '    this.status = status;\n' +
      '    this.code = code;\n' +
      '    this.errorType = errorType;\n' +
      '    this.requestId = requestId;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'export function getCashfreeConfig(): CashfreeConfig {\n' +
      '  const appId = Deno.env.get("CASHFREE_APP_ID");\n' +
      '  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");\n' +
      '  let environment = Deno.env.get("CASHFREE_ENV") as CashfreeEnvironment | undefined;\n' +
      '  \n' +
      '  if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");\n' +
      '  \n' +
      "  // Auto-detect environment if it's mismatched or missing, since Sandbox IDs always start with TEST\n" +
      '  const detectedEnv = appId.startsWith("TEST") ? "sandbox" : "production";\n' +
      '  if (environment !== detectedEnv) {\n' +
      '    console.log(`[Cashfree Config] Auto-correcting environment to ${detectedEnv} based on App ID prefix.`);\n' +
      '    environment = detectedEnv;\n' +
      '  }\n' +
      '\n' +
      '  return {\n' +
      '    appId,\n' +
      '    secretKey,\n' +
      '    environment,\n' +
      '    baseUrl: environment === "sandbox"\n' +
      '      ? "https://sandbox.cashfree.com/pg"\n' +
      '      : "https://api.cashfree.com/pg",\n' +
      '  };\n' +
      '}\n' +
      '\n' +
      'async function cashfreeRequest<T>(\n' +
      '  path: string,\n' +
      '  requestId: string,\n' +
      '  init: RequestInit = {},\n' +
      '  idempotencyKey?: string,\n' +
      '): Promise<T> {\n' +
      '  const config = getCashfreeConfig();\n' +
      '  const controller = new AbortController();\n' +
      '  const timeout = setTimeout(() => controller.abort(), 12_000);\n' +
      '  try {\n' +
      '    const response = await fetch(`${config.baseUrl}${path}`, {\n' +
      '      ...init,\n' +
      '      signal: controller.signal,\n' +
      '      headers: {\n' +
      '        Accept: "application/json",\n' +
      '        "Content-Type": "application/json",\n' +
      '        "x-api-version": CASHFREE_API_VERSION,\n' +
      '        "x-client-id": config.appId,\n' +
      '        "x-client-secret": config.secretKey,\n' +
      '        "x-request-id": requestId,\n' +
      '        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),\n' +
      '        ...init.headers,\n' +
      '      },\n' +
      '    });\n' +
      '    const data = await response.json().catch(() => null) as Record<string, unknown> | null;\n' +
      '    if (!response.ok) {\n' +
      '      throw new CashfreeApiError(\n' +
      '        typeof data?.message === "string" ? data.message : "Cashfree request failed.",\n' +
      '        response.status,\n' +
      '        typeof data?.code === "string" ? data.code : null,\n' +
      '        typeof data?.type === "string" ? data.type : null,\n' +
      '        requestId,\n' +
      '      );\n' +
      '    }\n' +
      '    return data as T;\n' +
      '  } catch (error: unknown) {\n' +
      '    if (error instanceof CashfreeApiError) throw error;\n' +
      '    const message = error instanceof DOMException && error.name === "AbortError"\n' +
      '      ? "Cashfree request timed out."\n' +
      '      : "Unable to reach Cashfree.";\n' +
      '    throw new CashfreeApiError(message, 0, null, "network_error", requestId);\n' +
      '  } finally {\n' +
      '    clearTimeout(timeout);\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'export function createCashfreeOrder(\n' +
      '  payload: Record<string, unknown>,\n' +
      '  requestId: string,\n' +
      '  idempotencyKey: string,\n' +
      ') {\n' +
      '  return cashfreeRequest<CashfreeOrder>(\n' +
      '    "/orders",\n' +
      '    requestId,\n' +
      '    { method: "POST", body: JSON.stringify(payload) },\n' +
      '    idempotencyKey,\n' +
      '  );\n' +
      '}\n' +
      '\n' +
      'export function getCashfreeOrder(orderId: string, requestId: string) {\n' +
      '  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);\n' +
      '}\n' +
      '\n' +
      'export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {\n' +
      '  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);\n' +
      '}\n' +
      '\n' +
      'export function validateCashfreeEarlyAccessEvidence(\n' +
      '  order: CashfreeOrder,\n' +
      '  payments: CashfreePayment[],\n' +
      '  expected: {\n' +
      '    orderId: string;\n' +
      '    workspaceId: string;\n' +
      '    internalPaymentId: string;\n' +
      '    amountPaise: number;\n' +
      '    currency: string;\n' +
      '    paymentType: string;\n' +
      '  },\n' +
      '  amountToPaise: (value: string | number) => number | null,\n' +
      '): CashfreeEarlyAccessEvidence {\n' +
      '  if (\n' +
      '    order.order_id !== expected.orderId\n' +
      '    || amountToPaise(order.order_amount) !== expected.amountPaise\n' +
      '    || order.order_currency !== expected.currency\n' +
      '    || order.customer_details?.customer_id !== expected.workspaceId\n' +
      '    || order.order_tags?.product !== expected.paymentType\n' +
      '    || order.order_tags?.workspace_id !== expected.workspaceId\n' +
      '    || order.order_tags?.internal_payment_id !== expected.internalPaymentId\n' +
      '  ) {\n' +
      '    throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");\n' +
      '  }\n' +
      '\n' +
      '  const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");\n' +
      '  const successfulPayment = successfulPayments.find((payment) => (\n' +
      '    payment.order_id === expected.orderId\n' +
      '    && amountToPaise(payment.order_amount) === expected.amountPaise\n' +
      '    && payment.payment_currency === expected.currency\n' +
      '  ));\n' +
      '  if (successfulPayments.length > 0 && !successfulPayment) {\n' +
      '    throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");\n' +
      '  }\n' +
      '  if (order.order_status === "PAID" && successfulPayment) {\n' +
      '    return {\n' +
      '      state: "paid",\n' +
      '      paymentId: String(successfulPayment.cf_payment_id),\n' +
      '      paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),\n' +
      '    };\n' +
      '  }\n' +
      '\n' +
      '  const statuses = new Set(payments.map((payment) => payment.payment_status));\n' +
      '  if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {\n' +
      '    return { state: "pending", paymentId: null, paidAt: null };\n' +
      '  }\n' +
      '  if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };\n' +
      '  if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };\n' +
      '  return { state: "pending", paymentId: null, paidAt: null };\n' +
      '}\n' +
      '\n' +
      'export async function verifyCashfreeWebhookSignature(\n' +
      '  rawBody: string,\n' +
      '  timestamp: string,\n' +
      '  signature: string,\n' +
      ') {\n' +
      '  const { secretKey } = getCashfreeConfig();\n' +
      '  let supplied: Uint8Array<ArrayBuffer>;\n' +
      '  try {\n' +
      '    supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));\n' +
      '  } catch {\n' +
      '    return false;\n' +
      '  }\n' +
      '\n' +
      '  const encoder = new TextEncoder();\n' +
      '  const key = await crypto.subtle.importKey(\n' +
      '    "raw",\n' +
      '    encoder.encode(secretKey),\n' +
      '    { name: "HMAC", hash: "SHA-256" },\n' +
      '    false,\n' +
      '    ["verify"],\n' +
      '  );\n' +
      '  return crypto.subtle.verify(\n' +
      '    "HMAC",\n' +
      '    key,\n' +
      '    supplied,\n' +
      '    encoder.encode(`${timestamp}${rawBody}`),\n' +
      '  );\n' +
      '}\n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    export const CASHFREE_API_VERSION = "2023-08-01";
    
    declare const Deno: { env: { get(key: string): string | undefined } };
    
    export type CashfreeEnvironment = "sandbox" | "production";
    
    export type CashfreeOrder = {
      cf_order_id: string;
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
      payment_session_id?: string;
      customer_details?: {
        customer_id?: string;
        customer_email?: string;
        customer_phone?: string;
        customer_name?: string;
      };
      order_tags?: Record<string, string> | null;
    };
    
    export type CashfreePayment = {
      cf_payment_id: string | number;
      order_id: string;
      order_amount: number;
      order_currency: string;
      payment_amount: number;
      payment_currency: string;
      payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
      payment_time?: string;
      payment_completion_time?: string;
    };
    
    export type CashfreeEarlyAccessEvidence = {
      state: "paid" | "pending" | "failed" | "cancelled" | "user_dropped" | "void";
      paymentId: string | null;
      paidAt: string | null;
    };
    
    type CashfreeConfig = {
      appId: string;
      secretKey: string;
      environment: CashfreeEnvironment;
      baseUrl: string;
    };
    
    export class CashfreeApiError extends Error {
      readonly status: number;
      readonly code: string | null;
      readonly errorType: string | null;
      readonly requestId: string;
    
      constructor(
        message: string,
        status: number,
        code: string | null,
        errorType: string | null,
        requestId: string,
      ) {
        super(message);
        this.name = "CashfreeApiError";
        this.status = status;
        this.code = code;
        this.errorType = errorType;
        this.requestId = requestId;
      }
    }
    
    export function getCashfreeConfig(): CashfreeConfig {
      const appId = Deno.env.get("CASHFREE_APP_ID");
      const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
      let environment = Deno.env.get("CASHFREE_ENV") as CashfreeEnvironment | undefined;
      
      if (!appId || !secretKey) throw new Error("Cashfree credentials are not configured.");
      
      // Auto-detect environment if it's mismatched or missing, since Sandbox IDs always start with TEST
      const detectedEnv = appId.startsWith("TEST") ? "sandbox" : "production";
      if (environment !== detectedEnv) {
        console.log(`[Cashfree Config] Auto-correcting environment to ${detectedEnv} based on App ID prefix.`);
        environment = detectedEnv;
      }
    
      return {
        appId,
        secretKey,
        environment,
        baseUrl: environment === "sandbox"
          ? "https://sandbox.cashfree.com/pg"
          : "https://api.cashfree.com/pg",
      };
    }
    
    async function cashfreeRequest<T>(
      path: string,
      requestId: string,
      init: RequestInit = {},
      idempotencyKey?: string,
    ): Promise<T> {
      const config = getCashfreeConfig();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(`${config.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-version": CASHFREE_API_VERSION,
            "x-client-id": config.appId,
            "x-client-secret": config.secretKey,
            "x-request-id": requestId,
            ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
            ...init.headers,
          },
        });
        const data = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok) {
          throw new CashfreeApiError(
            typeof data?.message === "string" ? data.message : "Cashfree request failed.",
            response.status,
            typeof data?.code === "string" ? data.code : null,
            typeof data?.type === "string" ? data.type : null,
            requestId,
          );
        }
        return data as T;
      } catch (error: unknown) {
        if (error instanceof CashfreeApiError) throw error;
        const message = error instanceof DOMException && error.name === "AbortError"
          ? "Cashfree request timed out."
          : "Unable to reach Cashfree.";
        throw new CashfreeApiError(message, 0, null, "network_error", requestId);
      } finally {
        clearTimeout(timeout);
      }
    }
    
    export function createCashfreeOrder(
      payload: Record<string, unknown>,
      requestId: string,
      idempotencyKey: string,
    ) {
      return cashfreeRequest<CashfreeOrder>(
        "/orders",
        requestId,
        { method: "POST", body: JSON.stringify(payload) },
        idempotencyKey,
      );
    }
    
    export function getCashfreeOrder(orderId: string, requestId: string) {
      return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, requestId);
    }
    
    export function getCashfreePaymentsForOrder(orderId: string, requestId: string) {
      return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(orderId)}/payments`, requestId);
    }
    
    export function validateCashfreeEarlyAccessEvidence(
      order: CashfreeOrder,
      payments: CashfreePayment[],
      expected: {
        orderId: string;
        workspaceId: string;
        internalPaymentId: string;
        amountPaise: number;
        currency: string;
        paymentType: string;
      },
      amountToPaise: (value: string | number) => number | null,
    ): CashfreeEarlyAccessEvidence {
      if (
        order.order_id !== expected.orderId
        || amountToPaise(order.order_amount) !== expected.amountPaise
        || order.order_currency !== expected.currency
        || order.customer_details?.customer_id !== expected.workspaceId
        || order.order_tags?.product !== expected.paymentType
        || order.order_tags?.workspace_id !== expected.workspaceId
        || order.order_tags?.internal_payment_id !== expected.internalPaymentId
      ) {
        throw new Error("CASHFREE_ORDER_EVIDENCE_MISMATCH");
      }
    
      const successfulPayments = payments.filter((payment) => payment.payment_status === "SUCCESS");
      const successfulPayment = successfulPayments.find((payment) => (
        payment.order_id === expected.orderId
        && amountToPaise(payment.order_amount) === expected.amountPaise
        && payment.payment_currency === expected.currency
      ));
      if (successfulPayments.length > 0 && !successfulPayment) {
        throw new Error("CASHFREE_PAYMENT_EVIDENCE_MISMATCH");
      }
      if (order.order_status === "PAID" && successfulPayment) {
        return {
          state: "paid",
          paymentId: String(successfulPayment.cf_payment_id),
          paidAt: successfulPayment.payment_completion_time || successfulPayment.payment_time || new Date().toISOString(),
        };
      }
    
      const statuses = new Set(payments.map((payment) => payment.payment_status));
      if (statuses.has("PENDING") || statuses.has("NOT_ATTEMPTED") || payments.length === 0) {
        return { state: "pending", paymentId: null, paidAt: null };
      }
      if (statuses.has("USER_DROPPED")) return { state: "user_dropped", paymentId: null, paidAt: null };
      if (statuses.has("CANCELLED")) return { state: "cancelled", paymentId: null, paidAt: null };
      if (statuses.has("VOID")) return { state: "void", paymentId: null, paidAt: null };
      if (statuses.has("FAILED")) return { state: "failed", paymentId: null, paidAt: null };
      return { state: "pending", paymentId: null, paidAt: null };
    }
    
    export async function verifyCashfreeWebhookSignature(
      rawBody: string,
      timestamp: string,
      signature: string,
    ) {
      const { secretKey } = getCashfreeConfig();
      let supplied: Uint8Array<ArrayBuffer>;
      try {
        supplied = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
      } catch {
        return false;
      }
    
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      return crypto.subtle.verify(
        "HMAC",
        key,
        supplied,
        encoder.encode(`${timestamp}${rawBody}`),
      );
    }
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (file:///Users/rahulg/adsHunting%202/tests/early-access.test.ts:54:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.processPendingSubtests (node:internal/test_runner/test:744:18)
    Test.postRun (node:internal/test_runner/test:1173:19)
    Test.run (node:internal/test_runner/test:1101:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Cashfree evidence maps paid, pending, failed, cancelled, and dropped states without granting early
ok 16 - Cashfree evidence maps paid, pending, failed, cancelled, and dropped states without granting early
  ---
  duration_ms: 0.806
  type: 'test'
  ...
# Subtest: database finalization makes access and credits atomic and idempotent
ok 17 - database finalization makes access and credits atomic and idempotent
  ---
  duration_ms: 0.232834
  type: 'test'
  ...
# Subtest: signed webhook re-fetches provider state before using the same finalization path
ok 18 - signed webhook re-fetches provider state before using the same finalization path
  ---
  duration_ms: 0.108375
  type: 'test'
  ...
# Subtest: browser checkout uses Cashfree v3 and never treats browser data as fulfillment evidence
ok 19 - browser checkout uses Cashfree v3 and never treats browser data as fulfillment evidence
  ---
  duration_ms: 0.076167
  type: 'test'
  ...
# Subtest: active runtime billing surface has no Razorpay integration
ok 20 - active runtime billing surface has no Razorpay integration
  ---
  duration_ms: 0.070291
  type: 'test'
  ...
1..20
# tests 20
# suites 0
# pass 18
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 311.565625
```

## 4. Database RPC Definitions (Full SQL)

### `finalize_early_access_purchase`

*Source: `supabase/migrations/20260908000100_early_access_checkout.sql` (Lines 39–117)*

```sql
create or replace function public.finalize_early_access_purchase(
  p_workspace_id text,
  p_provider text,
  p_order_id text,
  p_payment_id text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.billing_payments%rowtype;
  v_balance public.workspace_credit_balances%rowtype;
begin
  select * into v_payment
  from public.billing_payments
  where workspace_id = p_workspace_id
    and provider = p_provider
    and provider_order_id = p_order_id
    and payment_type = 'early_access'
  for update;

  if not found then
    raise exception 'EARLY_ACCESS_PAYMENT_NOT_FOUND';
  end if;

  if v_payment.base_amount_paise is distinct from 49900
     or v_payment.gst_amount_paise is distinct from 8982
     or v_payment.amount_paise is distinct from 58882
     or v_payment.currency is distinct from 'INR' then
    raise exception 'EARLY_ACCESS_AMOUNT_MISMATCH';
  end if;

  if v_payment.provider_payment_id is not null
     and v_payment.provider_payment_id <> p_payment_id then
    raise exception 'EARLY_ACCESS_PAYMENT_ID_MISMATCH';
  end if;

  update public.billing_payments
  set provider_payment_id = p_payment_id,
      status = 'paid',
      paid_at = coalesce(paid_at, p_paid_at),
      failed_at = null,
      credits_granted = 3000,
      updated_at = now()
  where id = v_payment.id;

  insert into public.billing_access_grants (workspace_id, grant_type, starts_at, ends_at, reason)
  values (p_workspace_id, 'early_access', p_paid_at, null, 'verified_cashfree_early_access_purchase')
  on conflict (workspace_id, grant_type) do nothing;

  insert into public.workspace_credit_balances (
    workspace_id, subscription_id, cycle_start, cycle_end,
    credits_allocated, credits_used, source_payment_id
  ) values (
    p_workspace_id, null, p_paid_at, 'infinity'::timestamptz,
    3000, 0, v_payment.id
  )
  on conflict (source_payment_id) where source_payment_id is not null do nothing;

  select * into v_balance
  from public.workspace_credit_balances
  where source_payment_id = v_payment.id;

  return jsonb_build_object(
    'active', true,
    'alreadyProcessed', v_payment.status = 'paid',
    'creditsGranted', 3000,
    'creditsRemaining', greatest(0, v_balance.credits_allocated - v_balance.credits_used)
  );
end;
$$;

revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from public;
revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from anon;
revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from authenticated;
grant execute on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) to service_role;
```

### `report_search_and_delivery_usage`

*Source: `supabase/migrations/20260908120000_credit_schema_refinement.sql` (Lines 12–115)*

```sql
CREATE OR REPLACE FUNCTION public.report_search_and_delivery_usage(
  p_workspace_id text,
  p_user_id text,
  p_search_session_id text,
  p_base_event_type text,
  p_base_fingerprint text,
  p_base_cost integer,
  p_delivery_event_type text,
  p_delivery_ad_ids text[],
  p_delivery_cost integer,
  p_metadata jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_record record;
  v_ad_id text;
  v_actually_charged integer := 0;
  v_remaining_before integer;
  v_accepted_ad_ids text[] := '{}';
  v_base_charged boolean := false;
  v_inserted boolean;
BEGIN
  -- 1. Lock active billing cycle
  SELECT * INTO v_balance_record
  FROM public.workspace_credit_balances
  WHERE workspace_id = p_workspace_id AND cycle_end > now()
  ORDER BY cycle_start desc
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_CYCLE', 'message', 'No active billing cycle found.', 'creditsRemaining', 0);
  END IF;

  v_remaining_before := v_balance_record.credits_allocated - v_balance_record.credits_used;

  -- 2. Process Base Charge Idempotently
  IF p_base_cost > 0 AND p_base_fingerprint IS NOT NULL THEN
    IF v_remaining_before < p_base_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'message', 'Insufficient credits for base search.', 'creditsRemaining', v_remaining_before, 'exhausted', true);
    END IF;

    -- ON CONFLICT DO NOTHING makes it idempotent without catching exceptions
    INSERT INTO public.credit_usage_events (
      workspace_id, user_id, search_session_id, event_type, idempotency_key, credits, billing_cycle_id, metadata
    ) VALUES (
      p_workspace_id, p_user_id, p_search_session_id, p_base_event_type, p_base_fingerprint, p_base_cost, v_balance_record.id, p_metadata
    )
    ON CONFLICT (workspace_id, search_session_id, idempotency_key, event_type) DO NOTHING
    RETURNING true INTO v_inserted;

    IF v_inserted THEN
      v_actually_charged := v_actually_charged + p_base_cost;
      v_base_charged := true;
    END IF;
  END IF;

  -- 3. Process Delivery Charges
  IF array_length(p_delivery_ad_ids, 1) > 0 THEN
    FOREACH v_ad_id IN ARRAY p_delivery_ad_ids LOOP
      -- Check affordability for this ad
      IF (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) < p_delivery_cost THEN
        CONTINUE;
      END IF;

      INSERT INTO public.credit_usage_events (
        workspace_id, user_id, search_session_id, ad_id, event_type, idempotency_key, credits, billing_cycle_id, metadata
      ) VALUES (
        p_workspace_id, p_user_id, p_search_session_id, v_ad_id, p_delivery_event_type, v_ad_id, p_delivery_cost, v_balance_record.id, p_metadata
      )
      ON CONFLICT (workspace_id, search_session_id, idempotency_key, event_type) DO NOTHING
      RETURNING true INTO v_inserted;

      IF v_inserted THEN
        v_actually_charged := v_actually_charged + p_delivery_cost;
        v_accepted_ad_ids := array_append(v_accepted_ad_ids, v_ad_id);
      END IF;
    END LOOP;
  END IF;

  -- 4. Update Balance
  IF v_actually_charged > 0 THEN
    UPDATE public.workspace_credit_balances
    SET credits_used = credits_used + v_actually_charged,
        updated_at = now()
    WHERE id = v_balance_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'creditsChargedThisRequest', v_actually_charged,
    'baseCharged', v_base_charged,
    'acceptedAdIds', v_accepted_ad_ids,
    'creditsRemaining', v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged),
    'creditsAllocated', v_balance_record.credits_allocated,
    'creditsUsed', v_balance_record.credits_used + v_actually_charged,
    'exhausted', (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) <= 0
  );
END;
$$;
```

### `activate_session_if_newer`

*Source: `supabase/migrations/202608240003_single_active_session.sql` (Lines 19–76)*

```sql
CREATE OR REPLACE FUNCTION public.activate_session_if_newer(
    p_user_id TEXT,
    p_session_id TEXT,
    p_session_created_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
    v_existing_created_at TIMESTAMPTZ;
BEGIN
    -- Attempt to get the current active session creation time, locking the row for update
    SELECT session_created_at INTO v_existing_created_at
    FROM public.user_active_sessions
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- No existing session, safe to insert
        INSERT INTO public.user_active_sessions (user_id, active_session_id, session_created_at)
        VALUES (p_user_id, p_session_id, p_session_created_at);
        RETURN TRUE;
    END IF;

    -- If the incoming session is strictly older than the existing one, reject it.
    -- (If they are equal, we also reject to avoid continuous flip-flopping, 
    -- unless it's the exact same session_id being re-activated which is fine).
    IF p_session_created_at < v_existing_created_at THEN
        RETURN FALSE;
    END IF;
    
    IF p_session_created_at = v_existing_created_at THEN
        -- Tie-breaker: If it's the exact same session, we can just return true.
        -- If it's a different session ID but exact same millisecond, we can use 
        -- alphabetical sorting of session ID as a deterministic tie-breaker.
        DECLARE
            v_existing_session_id TEXT;
        BEGIN
            SELECT active_session_id INTO v_existing_session_id
            FROM public.user_active_sessions
            WHERE user_id = p_user_id;

            IF v_existing_session_id = p_session_id THEN
                RETURN TRUE;
            ELSIF p_session_id < v_existing_session_id THEN
                RETURN FALSE;
            END IF;
        END;
    END IF;

    -- Incoming session is newer (or won the tie-breaker). Update the record.
    UPDATE public.user_active_sessions
    SET active_session_id = p_session_id,
        session_created_at = p_session_created_at,
        activated_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `get_brand_ad_stats`

*Source: `supabase/migrations/202608240004_brand_ad_stats.sql` (Lines 2–21)*

```sql
CREATE OR REPLACE FUNCTION public.get_brand_ad_stats(p_advertiser_ids text[])
RETURNS TABLE (
  advertiser_id text,
  total_ads bigint,
  active_ads bigint,
  latest_activity_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.advertiser_id,
    COUNT(DISTINCT COALESCE(NULLIF(a.canonical_ad_id, ''), a.id::text)) as total_ads,
    COUNT(DISTINCT CASE WHEN a.status = 'active' THEN COALESCE(NULLIF(a.canonical_ad_id, ''), a.id::text) ELSE NULL END) as active_ads,
    MAX(a.last_seen_at) as latest_activity_at
  FROM public.ads a
  WHERE a.advertiser_id = ANY(p_advertiser_ids)
  GROUP BY a.advertiser_id;
$$;
```

### `mark_verified_missing_ads`

*Source: `supabase/migrations/202608210001_canonical_ad_deduplication.sql` (Lines 18–27)*

```sql
CREATE OR REPLACE FUNCTION public.mark_verified_missing_ads(p_advertiser_id text, p_seen_external_ids text[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ads
  SET missing_checks = missing_checks + 1,
      status = case when missing_checks + 1 >= 3 then 'inactive' else status end,
      stop_date = case when missing_checks + 1 >= 3 then coalesce(stop_date, now()) else stop_date end
  WHERE advertiser_id = p_advertiser_id
    AND status = 'active'
    AND NOT (provider_ad_ids && p_seen_external_ids);
$$;
```
