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
