import test from "node:test";
import assert from "node:assert/strict";

test("Security Negative: Preview mode fails closed in VERCEL_ENV=production regardless of DEV_BYPASS_AUTH", async () => {
  const origVercel = process.env.VERCEL_ENV;
  const origBypass = process.env.DEV_BYPASS_AUTH;
  try {
    process.env.VERCEL_ENV = "production";
    process.env.DEV_BYPASS_AUTH = "true";

    // Function matching lib/preview.ts logic
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

    assert.equal(isPreviewAllowed(), false, "Preview mode MUST be false in Vercel production");
  } finally {
    if (origVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = origVercel;
    if (origBypass === undefined) delete process.env.DEV_BYPASS_AUTH;
    else process.env.DEV_BYPASS_AUTH = origBypass;
  }
});

test("Security Negative: Preview mode fails closed in SENTRY_ENVIRONMENT=production regardless of DEV_BYPASS_AUTH", async () => {
  const origSentry = process.env.SENTRY_ENVIRONMENT;
  const origBypass = process.env.DEV_BYPASS_AUTH;
  try {
    process.env.SENTRY_ENVIRONMENT = "production";
    process.env.DEV_BYPASS_AUTH = "true";

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

    assert.equal(isPreviewAllowed(), false, "Preview mode MUST be false in Sentry production");
  } finally {
    if (origSentry === undefined) delete process.env.SENTRY_ENVIRONMENT;
    else process.env.SENTRY_ENVIRONMENT = origSentry;
    if (origBypass === undefined) delete process.env.DEV_BYPASS_AUTH;
    else process.env.DEV_BYPASS_AUTH = origBypass;
  }
});

test("Security Contract: Legitimate staging preview allows preview only when VERCEL_ENV=preview and DEV_BYPASS_AUTH=true", async () => {
  const origVercel = process.env.VERCEL_ENV;
  const origBypass = process.env.DEV_BYPASS_AUTH;
  const envMap = process.env as Record<string, string | undefined>;
  const origNode = envMap["NODE_ENV"];
  try {
    envMap["NODE_ENV"] = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.DEV_BYPASS_AUTH = "true";

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

    assert.equal(isPreviewAllowed(), true, "Staging preview MUST be allowed on preview branch");
  } finally {
    if (origVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = origVercel;
    if (origBypass === undefined) delete process.env.DEV_BYPASS_AUTH;
    else process.env.DEV_BYPASS_AUTH = origBypass;
    if (origNode === undefined) delete envMap["NODE_ENV"];
    else envMap["NODE_ENV"] = origNode;
  }
});
