import "server-only";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalSecret = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalVersion = z.preprocess(emptyToUndefined, z.string().regex(/^v\d+\.\d+$/).optional());
const optionalCountry = z.preprocess(emptyToUndefined, z.string().regex(/^[A-Za-z ]{2,56}$|^ALL$/).optional());
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  SEARCH_API_KEY: optionalSecret,
  SEARCH_API_KEYS: optionalSecret,
  SEARCH_API_KEY_1: optionalSecret,
  SEARCH_API_KEY_2: optionalSecret,
  SEARCH_API_KEY_3: optionalSecret,
  SEARCH_API_KEY_4: optionalSecret,
  FOREPLAY_API_KEY: optionalSecret,
  SPYGLASS_API_KEY: optionalSecret,
  SPYGLASS_ENABLED: z.enum(["true", "false"]).default("false"),
  ADS_PROVIDER_ORDER: z.string().default("spyglass,foreplay,searchapi"),
  // Legacy single provider option (kept for backwards compatibility or override)
  ADS_PROVIDER: z.enum(["auto", "searchapi", "meta", "foreplay", "spyglass"]).default("auto"),
  META_APP_ID: optionalSecret,
  META_APP_SECRET: optionalSecret,
  META_AD_LIBRARY_ACCESS_TOKEN: optionalSecret,
  META_AD_LIBRARY_ENABLED: z.enum(["true", "false"]).default("false"),
  META_API_VERSION: optionalVersion,
  META_DEFAULT_COUNTRY: optionalCountry,
  META_API_TIMEOUT_MS: z.string().optional(),
  GOOGLE_API_KEY: optionalSecret,
  GOOGLE_SEARCH_ENGINE_ID: optionalSecret,
  ALLOW_MEDIA_ARCHIVAL: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  serviceRoleKey?: string;
  searchApiKey?: string;
  searchApiKeys: string[];
  foreplayApiKey?: string;
  spyglassApiKey?: string;
  spyglassEnabled: boolean;
  adsProviderOrder: string[];
  adsProvider: "auto" | "searchapi" | "meta" | "foreplay" | "spyglass";
  metaAppId?: string;
  metaAppSecret?: string;
  metaAccessToken?: string;
  metaEnabled: boolean;
  metaApiVersion?: string;
  metaDefaultCountry?: string;
  metaTimeoutMs?: string;
  googleApiKey?: string;
  googleSearchEngineId?: string;
  allowMediaArchival: boolean;
};

export function getServerEnv(): ServerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}.`);
  }
  const env = parsed.data;
  const searchApiKeys = parseSearchApiKeys([
    env.SEARCH_API_KEY,
    env.SEARCH_API_KEYS,
    env.SEARCH_API_KEY_1,
    env.SEARCH_API_KEY_2,
    env.SEARCH_API_KEY_3,
    env.SEARCH_API_KEY_4,
  ]);
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    searchApiKey: searchApiKeys[0],
    searchApiKeys,
    foreplayApiKey: env.FOREPLAY_API_KEY,
    spyglassApiKey: env.SPYGLASS_API_KEY,
    spyglassEnabled: env.SPYGLASS_ENABLED === "true",
    adsProviderOrder: env.ADS_PROVIDER_ORDER.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    adsProvider: env.ADS_PROVIDER,
    metaAppId: env.META_APP_ID,
    metaAppSecret: env.META_APP_SECRET,
    metaAccessToken: env.META_AD_LIBRARY_ACCESS_TOKEN,
    metaEnabled: env.META_AD_LIBRARY_ENABLED === "true",
    metaApiVersion: env.META_API_VERSION,
    metaDefaultCountry: normalizeCountry(env.META_DEFAULT_COUNTRY),
    metaTimeoutMs: env.META_API_TIMEOUT_MS,
    googleApiKey: env.GOOGLE_API_KEY,
    googleSearchEngineId: env.GOOGLE_SEARCH_ENGINE_ID,
    allowMediaArchival: env.ALLOW_MEDIA_ARCHIVAL === "true",
  };
}

export function integrationConfig() {
  const env = getServerEnv();
  return {
    supabase: Boolean(env.supabaseUrl && env.supabaseAnonKey && env.serviceRoleKey),
    searchApi: env.searchApiKeys.length > 0,
    foreplay: Boolean(env.foreplayApiKey),
    spyglass: Boolean(env.spyglassApiKey && env.spyglassEnabled),
    meta: Boolean(env.metaAccessToken && env.metaApiVersion && env.metaEnabled),
    googleSearch: Boolean(env.googleApiKey && env.googleSearchEngineId),
    mediaArchival: env.allowMediaArchival,
  };
}

export const isSearchConfigured = parseSearchApiKeys([
  process.env.SEARCH_API_KEY,
  process.env.SEARCH_API_KEYS,
  process.env.SEARCH_API_KEY_1,
  process.env.SEARCH_API_KEY_2,
  process.env.SEARCH_API_KEY_3,
  process.env.SEARCH_API_KEY_4,
]).length > 0;
export const isForeplayConfigured = Boolean(process.env.FOREPLAY_API_KEY);
export const isSpyglassConfigured = Boolean(process.env.SPYGLASS_API_KEY && process.env.SPYGLASS_ENABLED === "true");
export const isMetaConfigured = Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN && process.env.META_API_VERSION);
export const isGoogleSearchConfigured = Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID);
export const isAnyAdsProviderConfigured = isSearchConfigured || isMetaConfigured || isForeplayConfigured || isSpyglassConfigured;

function normalizeCountry(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  const known: Record<string, string> = {
    india: "IN", "united states": "US", "united kingdom": "GB", canada: "CA",
    australia: "AU", germany: "DE", france: "FR", brazil: "BR",
  };
  if (known[normalized]) return known[normalized];
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase();
  if (normalized === "all") return "ALL";
  throw new Error("META_DEFAULT_COUNTRY must be a supported country name, a two-letter ISO code, or ALL.");
}

function parseSearchApiKeys(values: Array<string | undefined>) {
  return [...new Set(
    values
      .flatMap((value) => value?.split(/[\s,]+/) ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}
