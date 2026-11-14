import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("legacy FAQ route permanently redirects before workspace authentication", () => {
  const nextConfig = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

  assert.match(
    nextConfig,
    /source:\s*["']\/faq["'][\s\S]*?destination:\s*["']\/resources\/help["'][\s\S]*?permanent:\s*true/,
  );
});

test("desktop workflow artwork cannot create page-level horizontal overflow", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), "components/landing/sections/WorkflowSection.tsx"),
    "utf8",
  );

  assert.match(workflow, /<section id="workflow" className="[^"]*overflow-x-clip[^"]*">/);
});

test("Clerk proxy cannot be bypassed while protected layouts use auth", () => {
  const proxy = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");

  assert.match(proxy, /export const proxy = clerkMiddleware\(/);
  assert.doesNotMatch(proxy, /DEV_BYPASS_AUTH/);
});

test("Sentry requires an explicit deployment environment", () => {
  for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
    const config = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(config, /SENTRY_ENVIRONMENT \?\? process\.env\.VERCEL_ENV/);
    assert.doesNotMatch(config, /enabled:\s*process\.env\.NODE_ENV === "production"/);
    assert.match(config, /VERCEL_GIT_COMMIT_SHA/);
  }
});

test("Discover retry preserves the billable search session", () => {
  const discover = fs.readFileSync(
    path.join(process.cwd(), "components/discover-experience.tsx"),
    "utf8",
  );

  assert.match(
    discover,
    /Retry search[\s\S]*?sessionId: searchSessionIdRef\.current \|\| undefined|sessionId: searchSessionIdRef\.current \|\| undefined[\s\S]*?Retry search/,
  );
});

test("search results cannot bypass ledger accounting through a process cache", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/search/route.ts"), "utf8");

  assert.doesNotMatch(route, /const cache = new Map/);
  assert.doesNotMatch(route, /cache\.get\(/);
  assert.match(route, /await consumeUsage\(/);
});
