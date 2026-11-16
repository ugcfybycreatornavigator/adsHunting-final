import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getDemoAnalytics, getDemoDrilldown } from "../lib/ads-analytics/demo";
import { calculatedMetrics } from "../lib/ads-analytics/metrics";
import { parseDateRange, previousRange } from "../lib/ads-analytics/dates";

test("calculated analytics metrics handle formulas and zero denominators", () => {
  assert.deepEqual(calculatedMetrics({ spend: 100, impressions: 10_000, clicks: 200 }), {
    spend: 100, impressions: 10_000, clicks: 200, ctr: 2, cpc: .5, cpm: 10,
  });
  assert.deepEqual(calculatedMetrics({ spend: 0, impressions: 0, clicks: 0 }), {
    spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0,
  });
});

test("demo analytics are deterministic and internally consistent", () => {
  const first = getDemoAnalytics("2026-08-01", "2026-08-30");
  const second = getDemoAnalytics("2026-08-01", "2026-08-30");
  assert.deepEqual(first.summary, second.summary);
  assert.equal(first.daily.length, 30);
  assert.equal(first.campaigns.length, 8);
  assert.equal(first.summary.spend.toFixed(2), first.daily.reduce((sum, row) => sum + row.spend, 0).toFixed(2));
  assert.equal(first.summary.impressions, first.daily.reduce((sum, row) => sum + row.impressions, 0));
  assert.equal(first.summary.clicks, first.daily.reduce((sum, row) => sum + row.clicks, 0));
  assert.ok(Math.abs(first.platforms.reduce((sum, row) => sum + row.spend, 0) - first.summary.spend) < .01);
  assert.equal(first.mode, "demo");
});

test("report date validation prevents invalid or oversized ranges", () => {
  assert.throws(() => parseDateRange("2026-10-10", "2026-10-01"), /valid date range/);
  assert.throws(() => parseDateRange("2026-01-01", "2026-10-01"), /limited to 90 days/);
  assert.deepEqual(previousRange("2026-08-08", "2026-08-14"), { since: "2026-08-01", until: "2026-08-07" });
});

test("demo campaign, ad-set and ad hierarchy is deterministic and scoped", () => {
  const report = getDemoAnalytics("2026-09-01", "2026-09-07");
  const campaign = report.campaigns[0];
  const adSets = getDemoDrilldown({ level: "adset", parentId: campaign.id, since: "2026-09-01", until: "2026-09-07" });
  const repeated = getDemoDrilldown({ level: "adset", parentId: campaign.id, since: "2026-09-01", until: "2026-09-07" });
  assert.deepEqual({ ...adSets, generatedAt: "stable" }, { ...repeated, generatedAt: "stable" });
  assert.equal(adSets.rows.length, 3);
  assert.ok(adSets.rows.every(row => row.parentId === campaign.id && row.level === "adset" && row.daily.length === 7));
  assert.equal(adSets.rows.reduce((sum, row) => sum + row.spend, 0).toFixed(2), campaign.spend.toFixed(2));

  const ads = getDemoDrilldown({ level: "ad", parentId: adSets.rows[0].id, since: "2026-09-01", until: "2026-09-07" });
  assert.equal(ads.rows.length, 4);
  assert.ok(ads.rows.every(row => row.parentId === adSets.rows[0].id && row.level === "ad"));
  assert.equal(ads.rows.reduce((sum, row) => sum + row.spend, 0).toFixed(2), adSets.rows[0].spend.toFixed(2));
});

test("unknown demo parents return an honest empty report", () => {
  const result = getDemoDrilldown({ level: "adset", parentId: "not-a-campaign", since: "2026-09-01", until: "2026-09-07" });
  assert.deepEqual(result.rows, []);
  assert.equal(result.mode, "demo");
});

test("Meta token table is server-only and OAuth state is workspace-bound", () => {
  const root = path.join(__dirname, "..");
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261114000002_meta_ads_analytics.sql"), "utf8");
  const connect = fs.readFileSync(path.join(root, "app/api/ads-analytics/connect/route.ts"), "utf8");
  const callback = fs.readFileSync(path.join(root, "app/api/ads-analytics/callback/route.ts"), "utf8");
  assert.match(migration, /revoke all on public\.meta_ads_connections from anon, authenticated/i);
  assert.doesNotMatch(migration, /grant select on public\.meta_ads_connections to authenticated/i);
  assert.match(connect, /workspaceId: orgId \|\| userId/);
  assert.match(callback, /context\.workspaceId !== \(orgId \|\| userId\)/);
  assert.match(connect, /scope", "ads_read"/);
  assert.doesNotMatch(connect, /ads_management/);
});

test("analytics APIs preserve live-demo separation and workspace-scoped connection lookup", () => {
  const root = path.join(__dirname, "..");
  const reportRoute = fs.readFileSync(path.join(root, "app/api/ads-analytics/report/route.ts"), "utf8");
  const drilldownRoute = fs.readFileSync(path.join(root, "app/api/ads-analytics/drilldown/route.ts"), "utf8");
  assert.match(reportRoute, /getConnection\(workspaceId, connectionId\)/);
  assert.doesNotMatch(reportRoute, /getDemoAnalytics/);
  assert.match(drilldownRoute, /getConnection\(orgId \|\| userId, connectionId\)/);
  assert.match(drilldownRoute, /url\.searchParams\.get\("mode"\) === "demo"/);
});

test("CSV export includes BOM, escaping, and formula-injection protection", () => {
  const source = fs.readFileSync(path.join(__dirname, "../components/ads-analytics-dashboard.tsx"), "utf8");
  assert.match(source, /"\\uFEFF"/);
  assert.match(source, /function safeCsvCell/);
  assert.match(source, /\^\[=\+\\-@\]/);
});

test("Meta analytics encryption uses a 256-bit hex key and authenticated random nonces", async () => {
  const previous = process.env.META_ANALYTICS_ENCRYPTION_KEY;
  process.env.META_ANALYTICS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  try {
    const { encryptToken, decryptToken } = await import("../lib/ads-analytics/crypto");
    const fixture = "test-token-that-is-not-a-real-credential";
    const first = encryptToken(fixture);
    const second = encryptToken(fixture);
    assert.notEqual(first, second, "each encryption must use a fresh GCM IV");
    assert.equal(decryptToken(first), fixture);
    assert.equal(first.split(".").length, 3);
    const tampered = first.split(".");
    tampered[2] = `${tampered[2][0] === "A" ? "B" : "A"}${tampered[2].slice(1)}`;
    assert.throws(() => decryptToken(tampered.join(".")));
  } finally {
    if (previous === undefined) delete process.env.META_ANALYTICS_ENCRYPTION_KEY;
    else process.env.META_ANALYTICS_ENCRYPTION_KEY = previous;
  }
});

test("malformed Meta analytics encryption keys fail closed", async () => {
  const previous = process.env.META_ANALYTICS_ENCRYPTION_KEY;
  process.env.META_ANALYTICS_ENCRYPTION_KEY = "not-a-256-bit-hex-key";
  try {
    const { encryptToken } = await import("../lib/ads-analytics/crypto");
    assert.throws(() => encryptToken("fixture"), /Invalid server environment configuration|64 hexadecimal/);
  } finally {
    if (previous === undefined) delete process.env.META_ANALYTICS_ENCRYPTION_KEY;
    else process.env.META_ANALYTICS_ENCRYPTION_KEY = previous;
  }
});
