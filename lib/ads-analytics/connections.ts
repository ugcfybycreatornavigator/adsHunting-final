import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./crypto";
import type { ConnectedAnalyticsAccount } from "./types";

type ConnectionRow = {
  id: string; workspace_id: string; ad_account_id: string; ad_account_name: string;
  currency: string; timezone: string; encrypted_access_token: string; status: ConnectedAnalyticsAccount["status"];
  last_synced_at: string | null;
};

export async function listConnections(workspaceId: string): Promise<ConnectedAnalyticsAccount[]> {
  const { data, error } = await createAdminClient().from("meta_ads_connections")
    .select("id,ad_account_id,ad_account_name,currency,timezone,status,last_synced_at")
    .eq("workspace_id", workspaceId).order("created_at");
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data || []).map(row => ({ connectionId: row.id, id: row.ad_account_id, name: row.ad_account_name, currency: row.currency, timezone: row.timezone, status: row.status, lastSyncedAt: row.last_synced_at || undefined }));
}

export async function getConnection(workspaceId: string, connectionId: string): Promise<ConnectionRow | null> {
  const { data, error } = await createAdminClient().from("meta_ads_connections").select("*")
    .eq("workspace_id", workspaceId).eq("id", connectionId).maybeSingle();
  if (error) throw error;
  return data as ConnectionRow | null;
}

export function accessToken(row: ConnectionRow) { return decryptToken(row.encrypted_access_token); }
