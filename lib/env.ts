const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function isHttpsUrl(value?: string) {
  try { return Boolean(value && new URL(value).protocol === "https:"); } catch { return false; }
}

function isPlausiblePublicKey(value?: string) {
  return Boolean(value && (value.startsWith("sb_publishable_") || value.split(".").length === 3));
}

export const isSupabaseConfigured = isHttpsUrl(publicEnv.supabaseUrl) && isPlausiblePublicKey(publicEnv.supabaseAnonKey);

export function getPublicSupabaseEnv() {
  if (!isSupabaseConfigured || !publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) throw new Error("Supabase public environment variables are missing or invalid.");
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}
