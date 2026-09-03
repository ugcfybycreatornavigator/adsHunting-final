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
