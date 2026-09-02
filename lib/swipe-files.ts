import { SupabaseClient } from "@supabase/supabase-js";
import "server-only";

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function logSwipeFileError(error: SupabaseError, operation: string, adId?: string) {
  console.error("[SwipeFiles]", {
    operation,
    adId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export async function ensureDefaultSwipeFile(supabase: SupabaseClient, userId: string) {
  // First try to find it
  const { data: existing, error: findError } = await supabase
    .from("swipe_files")
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_key", "saved_ads")
    .maybeSingle();

  if (findError) {
    logSwipeFileError(findError, "ensureDefaultSwipeFile.find");
    throw new Error("Unable to resolve default Swipe File.");
  }

  if (existing) return existing.id;

  // Insert if not found, rely on unique constraint to prevent duplicates just in case
  const { data: inserted, error: insertError } = await supabase
    .from("swipe_files")
    .insert({
      user_id: userId,
      name: "Saved Ads",
      is_system: true,
      system_key: "saved_ads"
    })
    .select("id")
    .maybeSingle();

  if (inserted) return inserted.id;
  if (insertError && insertError.code !== "23505") {
    logSwipeFileError(insertError, "ensureDefaultSwipeFile.insert");
    throw new Error("Unable to create default Swipe File.");
  }

  // If insert failed (maybe constraint race), fetch again
  const { data: retry, error: retryError } = await supabase
    .from("swipe_files")
    .select("id")
    .eq("user_id", userId)
    .eq("system_key", "saved_ads")
    .single();

  if (retryError || !retry?.id) {
    if (retryError) logSwipeFileError(retryError, "ensureDefaultSwipeFile.retry");
    throw new Error("Unable to resolve default Swipe File.");
  }

  return retry.id;
}

export async function getSwipeFiles(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("swipe_files")
    .select(`
      id, name, description, is_system, system_key, created_at, updated_at,
      adCount:swipe_file_items(count),
      items:swipe_file_items(
        ads(thumbnail_url, source_media_url)
      )
    `)
    .eq("user_id", userId)
    .order("is_system", { ascending: false }) // Default file first
    .order("created_at", { ascending: true })
    .limit(3, { foreignTable: 'swipe_file_items' });

  if (error || !data) return [];
  
  // Create default in background or on demand if missing
  const hasDefault = data.some(d => d.is_system && d.system_key === "saved_ads");
  if (!hasDefault) {
    await ensureDefaultSwipeFile(supabase, userId);
    // If it was missing and we just created it, recursive call to get fresh list
    return getSwipeFiles(supabase, userId);
  }

  return data.map(d => {
    // Extract up to 3 preview images
    const items = d.items as unknown as { ads: { thumbnail_url?: string; source_media_url?: string } }[] | null;
    const previewMedia = items
      ?.map(item => item.ads?.thumbnail_url || item.ads?.source_media_url)
      .filter(Boolean)
      .slice(0, 3) as string[] || [];

    return {
      id: d.id,
      name: d.name,
      description: d.description,
      isSystem: d.is_system,
      systemKey: d.system_key,
      adCount: d.adCount?.[0]?.count || 0,
      previewMedia,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    };
  });
}

export async function getSwipeFile(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("swipe_files")
    .select(`
      id, name, description, is_system, system_key, created_at, updated_at,
      adCount:swipe_file_items(count)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    isSystem: data.is_system,
    systemKey: data.system_key,
    adCount: data.adCount?.[0]?.count || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function addAdToSwipeFile(supabase: SupabaseClient, userId: string, adId: string, swipeFileId?: string) {
  const targetFileId = swipeFileId || await ensureDefaultSwipeFile(supabase, userId);
  const { data, error } = await supabase
    .from("swipe_file_items")
    .insert({ swipe_file_id: targetFileId, ad_id: adId })
    .select("id")
    .maybeSingle();

  if (!error) {
    return { added: true, savedAdId: data?.id ?? null, adId, swipeFileId: targetFileId };
  }

  if (error.code !== "23505") {
    logSwipeFileError(error, "addAdToSwipeFile.insert", adId);
    throw new Error("Unable to save ad to Swipe File.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("swipe_file_items")
    .select("id")
    .eq("swipe_file_id", targetFileId)
    .eq("ad_id", adId)
    .maybeSingle();

  if (existingError) {
    logSwipeFileError(existingError, "addAdToSwipeFile.existing", adId);
    throw new Error("Unable to confirm saved ad.");
  }

  return { added: false, savedAdId: existing?.id ?? null, adId, swipeFileId: targetFileId };
}

export async function saveAdToDefaultSwipeFile(supabase: SupabaseClient, userId: string, adId: string) {
  return addAdToSwipeFile(supabase, userId, adId);
}

export async function toggleAdInSwipeFile(supabase: SupabaseClient, userId: string, adId: string, swipeFileId?: string) {
  
  let targetFileId = swipeFileId;
  if (!targetFileId) {
    targetFileId = await ensureDefaultSwipeFile(supabase, userId);
  }

  // Check if exists
  const { data: existing } = await supabase
    .from("swipe_file_items")
    .select("id")
    .eq("swipe_file_id", targetFileId)
    .eq("ad_id", adId)
    .maybeSingle();

  if (existing) {
    // Remove
    const { error } = await supabase.from("swipe_file_items").delete().eq("id", existing.id);
    if (error) {
      logSwipeFileError(error, "toggleAdInSwipeFile.delete", adId);
      throw new Error("Unable to remove ad from Swipe File.");
    }
    return { added: false, swipeFileId: targetFileId };
  } else {
    // Add
    return addAdToSwipeFile(supabase, userId, adId, targetFileId);
  }
}

export async function getAdSwipeFileMemberships(supabase: SupabaseClient, userId: string, adId: string) {
  const { data } = await supabase
    .from("swipe_file_items")
    .select("swipe_file_id, swipe_files!inner(user_id)")
    .eq("ad_id", adId)
    .eq("swipe_files.user_id", userId);
    
  if (!data) return [];
  return data.map(d => d.swipe_file_id);
}
