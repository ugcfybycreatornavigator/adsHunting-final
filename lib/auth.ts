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

  // Return scoped Supabase client operating under Clerk JWT / RLS constraints
  const supabase = await createClerkSupabaseServerClient();
  return { userId: authObj.userId, user: await currentUser(), supabase, error: null, sessionReplaced: false };
}
