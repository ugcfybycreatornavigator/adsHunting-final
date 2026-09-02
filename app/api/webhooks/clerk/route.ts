import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEvent } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SIGNING_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = evt.type;
  const admin = createAdminClient();

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address || "";
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

    const { error } = await admin.from("profiles").upsert(
      {
        id,
        clerk_user_id: id,
        email: primaryEmail,
        full_name: fullName,
        avatar_url: image_url || null,
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error upserting profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (eventType === "user.deleted") {
    const { id } = evt.data;
    console.log(`Clerk user deleted event received for user_id: ${id}`);
    // user_active_sessions is cleaned up via ON DELETE CASCADE
  } else if (eventType === "session.created") {
    const { user_id, id, created_at } = evt.data;
    if (user_id && id && created_at) {
      const { verifyAndActivateSession } = await import("@/lib/auth-session");
      await verifyAndActivateSession(user_id, id, admin);
    }
  } else if (eventType === "session.ended" || eventType === "session.revoked" || eventType === "session.removed") {
    const { user_id, id } = evt.data;
    if (user_id && id) {
      // Only clear if it's currently the active session
      const { data: activeSession } = await admin
        .from("user_active_sessions")
        .select("active_session_id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (activeSession && activeSession.active_session_id === id) {
        await admin.from("user_active_sessions").delete().eq("user_id", user_id).eq("active_session_id", id);
      }
    }
  }

  return NextResponse.json({ success: true });
}
