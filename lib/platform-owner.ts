import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export function getPlatformOwnerEmail(): string | null {
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim();
  return email ? email.toLowerCase() : null;
}

export const PLATFORM_OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL?.trim() || "";

const SAFE_ID_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Normalizes an email for reliable comparison against the platform owner email.
 * Fails safely (returns false) if PLATFORM_OWNER_EMAIL is not explicitly configured in environment.
 */
export function isPlatformOwnerEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const ownerEmail = getPlatformOwnerEmail();
  if (!ownerEmail) return false;
  return email.trim().toLowerCase() === ownerEmail;
}

/**
 * Checks if a given userId belongs to the platform owner.
 * First checks local Supabase profile cache, or checks Clerk user email.
 */
export async function isPlatformOwner(userId?: string | null): Promise<boolean> {
  if (!userId || typeof userId !== "string" || !SAFE_ID_REGEX.test(userId.trim())) {
    return false;
  }
  const cleanId = userId.trim();

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, is_platform_owner, role")
      .or(`id.eq."${cleanId}",clerk_user_id.eq."${cleanId}"`)
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
    if (user && (user.id === cleanId || !userId)) {
      const primaryEmail = user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

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
    email: getPlatformOwnerEmail() || "",
    role: isOwner ? ("OWNER" as const) : ("MEMBER" as const),
    unlimited: isOwner,
    hasPaidAccess: isOwner,
  };
}

/**
 * Self-healing bootstrap: ensures platform owner account has full access and flags set.
 */
export async function ensurePlatformOwner(userId?: string | null): Promise<void> {
  if (!userId || typeof userId !== "string" || !SAFE_ID_REGEX.test(userId.trim())) return;
  const cleanId = userId.trim();

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, is_platform_owner, role")
      .or(`id.eq."${cleanId}",clerk_user_id.eq."${cleanId}"`)
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
