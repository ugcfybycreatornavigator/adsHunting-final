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
