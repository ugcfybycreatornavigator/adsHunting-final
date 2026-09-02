import "server-only";

export type MetaTokenDebugResult = {
  isValid: boolean;
  appId: string | null;
  expiresAt: number | null;
  scopes: string[];
  status: "VALID" | "EXPIRED" | "INVALID" | "APP_MISMATCH" | "UNCHECKED";
  error?: string;
};

export const metaConfig = {
  get appId() {
    return process.env.META_APP_ID || "2120262955577311";
  },
  get appSecret() {
    return process.env.META_APP_SECRET;
  },
  get accessToken() {
    return process.env.META_ACCESS_TOKEN;
  },
  get apiVersion() {
    return process.env.META_API_VERSION || "v26.0";
  },
  get defaultCountry() {
    return process.env.META_DEFAULT_COUNTRY || "ALL";
  },
};

export async function validateMetaTokenServerSide(): Promise<MetaTokenDebugResult> {
  const token = metaConfig.accessToken;
  const version = metaConfig.apiVersion;
  const expectedAppId = metaConfig.appId;
  const appSecret = metaConfig.appSecret;

  if (!token) {
    return {
      isValid: false,
      appId: null,
      expiresAt: null,
      scopes: [],
      status: "INVALID",
      error: "META_ACCESS_TOKEN is missing.",
    };
  }

  // 1. Attempt token debugging endpoint if appSecret is configured
  if (appSecret) {
    try {
      const debugUrl = `https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(
        token
      )}&access_token=${encodeURIComponent(`${expectedAppId}|${appSecret}`)}`;

      const res = await fetch(debugUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const payload = await res.json().catch(() => ({}));

      if (payload.data) {
        const data = payload.data;
        const isValid = Boolean(data.is_valid);
        const tokenAppId = String(data.app_id || "");
        const expiresAt = typeof data.expires_at === "number" ? data.expires_at : null;
        const scopes = Array.isArray(data.scopes) ? data.scopes : [];

        if (!isValid) {
          return { isValid: false, appId: tokenAppId, expiresAt, scopes, status: "EXPIRED", error: "Token is expired or invalid." };
        }

        if (expectedAppId && tokenAppId && tokenAppId !== expectedAppId) {
          return {
            isValid: false,
            appId: tokenAppId,
            expiresAt,
            scopes,
            status: "APP_MISMATCH",
            error: `App ID mismatch. Token belongs to ${tokenAppId}, expected ${expectedAppId}.`,
          };
        }

        return { isValid: true, appId: tokenAppId, expiresAt, scopes, status: "VALID" };
      }
    } catch {}
  }

  // 2. Fallback basic Graph API test call: /me?fields=id,name
  try {
    const meUrl = `https://graph.facebook.com/${version}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
    const meRes = await fetch(meUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const meData = await meRes.json().catch(() => ({}));

    if (meRes.ok && meData.id) {
      return { isValid: true, appId: expectedAppId, expiresAt: null, scopes: [], status: "VALID" };
    }

    if (meData.error) {
      const code = meData.error.code;
      const msg = meData.error.message || "";
      if (code === 190 || msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("session")) {
        return { isValid: false, appId: expectedAppId, expiresAt: null, scopes: [], status: "EXPIRED", error: "Session has expired." };
      }
    }
  } catch {}

  return { isValid: false, appId: expectedAppId, expiresAt: null, scopes: [], status: "INVALID", error: "Meta authentication check failed." };
}
