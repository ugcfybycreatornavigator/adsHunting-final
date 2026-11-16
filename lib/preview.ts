import "server-only";

/**
 * Preview Mode Guard
 *
 * Strictly prevents authentication, entitlement, or RLS bypass in production environments.
 * Preview mode is ONLY permitted when ALL of the following conditions are met:
 * 1. The environment is NOT production (VERCEL_ENV !== 'production' and SENTRY_ENVIRONMENT !== 'production')
 * 2. If NODE_ENV is 'production' (e.g. built container), explicit staging preview must be allowed (VERCEL_ENV === 'preview' or ALLOW_STAGING_PREVIEW === 'true')
 * 3. DEV_BYPASS_AUTH === 'true' is explicitly set.
 */
function isPreviewAllowed(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.SENTRY_ENVIRONMENT === "production") return false;
  if (process.env.APP_ENV === "production") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview" &&
    process.env.ALLOW_STAGING_PREVIEW !== "true"
  ) {
    return false;
  }
  return process.env.DEV_BYPASS_AUTH === "true";
}

export const isPreviewMode = isPreviewAllowed();
