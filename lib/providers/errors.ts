export type ProviderErrorCode =
  | "MISSING_QUERY"
  | "PROVIDER_BAD_REQUEST"
  | "PROVIDER_AUTH"
  | "PROVIDER_FORBIDDEN"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_UNSUPPORTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_NOT_CONFIGURED"
  | "META_TOKEN_EXPIRED"
  | "META_TOKEN_INVALID"
  | "META_PERMISSION_ERROR"
  | "META_RATE_LIMIT"
  | "SEARCHAPI_AUTH_ERROR"
  | "SEARCHAPI_RATE_LIMIT"
  | "SEARCHAPI_UNAVAILABLE"
  | "FOREPLAY_AUTH_ERROR"
  | "FOREPLAY_RATE_LIMIT"
  | "FOREPLAY_QUOTA_EXCEEDED"
  | "FOREPLAY_UNAVAILABLE"
  | "FOREPLAY_BAD_RESPONSE";

export class ProviderError extends Error {
  constructor(public code: ProviderErrorCode, message: string, public status = 502) {
    super(message);
    this.name = "ProviderError";
  }
}

export function providerErrorFromStatus(provider: string, status: number, detail?: string) {
  const safeDetail = detail?.slice(0, 240);
  const isMeta = provider.toLowerCase().includes("meta");
  const isSearchApi = provider.toLowerCase().includes("searchapi");
  const isForeplay = provider.toLowerCase().includes("foreplay");

  if (status === 400) {
    if (isMeta && (safeDetail?.toLowerCase().includes("expired") || safeDetail?.toLowerCase().includes("token"))) {
      return new ProviderError("META_TOKEN_EXPIRED", "Meta access token has expired.", 401);
    }
    return new ProviderError("PROVIDER_BAD_REQUEST", safeDetail || `${provider} rejected the request.`, 400);
  }
  if (status === 401) {
    if (isMeta) return new ProviderError("META_TOKEN_EXPIRED", "Meta access token has expired or is invalid.", 401);
    if (isSearchApi) return new ProviderError("SEARCHAPI_AUTH_ERROR", "SearchAPI key is invalid or expired.", 401);
    if (isForeplay) return new ProviderError("FOREPLAY_AUTH_ERROR", "Foreplay API key is invalid or expired.", 401);
    return new ProviderError("PROVIDER_AUTH", `${provider} credentials are invalid or expired.`, 502);
  }
  if (status === 403) {
    if (isMeta) return new ProviderError("META_PERMISSION_ERROR", safeDetail || "Meta API permission error.", 403);
    return new ProviderError("PROVIDER_FORBIDDEN", safeDetail || `${provider} denied access. Check API permissions.`, 502);
  }
  if (status === 404) return new ProviderError("PROVIDER_NOT_FOUND", `${provider} resource was not found.`, 404);
  if (status === 429) {
    if (isMeta) return new ProviderError("META_RATE_LIMIT", "Meta API rate limit reached.", 429);
    if (isSearchApi) return new ProviderError("SEARCHAPI_RATE_LIMIT", "SearchAPI rate limit reached.", 429);
    if (isForeplay) return new ProviderError("FOREPLAY_RATE_LIMIT", "Foreplay rate limit reached.", 429);
    return new ProviderError("PROVIDER_RATE_LIMIT", `${provider} rate limit reached. Try again later.`, 429);
  }
  if (isForeplay) return new ProviderError("FOREPLAY_UNAVAILABLE", "Foreplay is temporarily unavailable.", 502);
  return new ProviderError("PROVIDER_UNAVAILABLE", `${provider} is temporarily unavailable.`, 502);
}
