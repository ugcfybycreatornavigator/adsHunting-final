import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Downloads media from an external URL and uploads it to Supabase Storage.
 * Server-side only.
 */
export async function archiveMediaFromUrl(
  supabase: SupabaseClient,
  url: string,
  storagePath: string
): Promise<{ path: string | null; error: unknown }> {
  try {
    const res = await fetch(url, { 
      redirect: "follow",
      // Set a reasonable timeout so we don't hang indefinitely on broken CDN links
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) {
      return { path: null, error: new Error(`HTTP ${res.status}: ${res.statusText}`) };
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentLength = Number(res.headers.get("content-length")) || 0;
    
    // Safety check: 50MB max limit
    if (contentLength > 52428800) {
      return { path: null, error: new Error("File exceeds 50MB size limit") };
    }

    const buffer = await res.arrayBuffer();
    
    if (buffer.byteLength > 52428800) {
      return { path: null, error: new Error("File exceeds 50MB size limit after download") };
    }

    // Upload to ad-creatives bucket
    const { data, error } = await supabase.storage
      .from("ad-creatives")
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: "public, max-age=31536000, immutable" // Cache forever
      });

    if (error) {
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (err) {
    return { path: null, error: err };
  }
}
