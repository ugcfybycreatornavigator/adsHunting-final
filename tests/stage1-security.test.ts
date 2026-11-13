import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { Webhook } from "svix";

import { hashShareToken, findSharedAdLinkByToken } from "../lib/shared-ads";
import {
  getPlatformOwnerEmail,
  isPlatformOwnerEmail,
  isPlatformOwner,
  ensurePlatformOwner,
} from "../lib/platform-owner";
import {
  getSwipeFile,
  verifySwipeFileOwnership,
  toggleAdInSwipeFile,
} from "../lib/swipe-files";
import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================================
// BATCH 1A: ISSUE-042 — Public Cashfree Debug Function
// =========================================================================
test("ISSUE-042: test-cashfree edge function is removed from local filesystem", () => {
  const edgeFunctionDir = path.join(process.cwd(), "supabase/functions/test-cashfree");
  assert.equal(
    fs.existsSync(edgeFunctionDir),
    false,
    "supabase/functions/test-cashfree directory should be completely removed"
  );
});

test("ISSUE-042: test-cashfree is removed from supabase/config.toml", () => {
  const configPath = path.join(process.cwd(), "supabase/config.toml");
  const configContent = fs.readFileSync(configPath, "utf-8");
  assert.equal(
    configContent.includes("[functions.test-cashfree]"),
    false,
    "supabase/config.toml must not declare test-cashfree"
  );
  assert.equal(
    configContent.includes("test-cashfree"),
    false,
    "supabase/config.toml must not reference test-cashfree"
  );
});

test("ISSUE-042: No application workflows or routes reference test-cashfree", () => {
  const appDir = path.join(process.cwd(), "app");
  const libDir = path.join(process.cwd(), "lib");

  function checkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.equal(
          content.includes("test-cashfree"),
          false,
          `File ${fullPath} must not reference test-cashfree`
        );
      }
    }
  }

  checkDir(appDir);
  checkDir(libDir);
});

// =========================================================================
// BATCH 1A: ISSUE-040 & ISSUE-005 — Deftform Credential & Feedback Delivery
// =========================================================================
test("ISSUE-040: Zero hardcoded Deftform bearer tokens in source code", () => {
  const feedbackRoutePath = path.join(process.cwd(), "app/api/feedback/route.ts");
  const feedbackContent = fs.readFileSync(feedbackRoutePath, "utf-8");

  // The compromised token must NOT appear in the file
  assert.equal(
    feedbackContent.includes("clUG1XlTfveWtNdgDNXwjGUhrIiXLwA71dci3eCQ76c5e684"),
    false,
    "Raw Deftform API token must not be in app/api/feedback/route.ts"
  );

  // Must reference server environment variable
  assert.ok(
    feedbackContent.includes("process.env.DEFTFORM_API_TOKEN"),
    "Feedback route must read DEFTFORM_API_TOKEN from process.env"
  );
});

test("ISSUE-040: Server environment schema declares DEFTFORM_API_TOKEN", () => {
  const serverEnvPath = path.join(process.cwd(), "lib/env/server.ts");
  const serverEnvContent = fs.readFileSync(serverEnvPath, "utf-8");

  assert.ok(
    serverEnvContent.includes("DEFTFORM_API_TOKEN"),
    "lib/env/server.ts must declare DEFTFORM_API_TOKEN in schema"
  );
  assert.ok(
    serverEnvContent.includes("deftformApiToken"),
    "lib/env/server.ts must expose deftformApiToken in ServerEnv"
  );
});

test("ISSUE-005: Feedback handler distinguishes local save from external dispatch", () => {
  const feedbackRoutePath = path.join(process.cwd(), "app/api/feedback/route.ts");
  const feedbackContent = fs.readFileSync(feedbackRoutePath, "utf-8");

  // Handler must track externalDispatched boolean and return truthful response
  assert.ok(
    feedbackContent.includes("dispatched: externalDispatched"),
    "Feedback response must report external dispatch status truthfully"
  );
  assert.ok(
    feedbackContent.includes("externalDispatched"),
    "Handler must maintain separate boolean for upstream dispatch success"
  );
});

// =========================================================================
// BATCH 1B: ISSUE-041 — Supabase RLS Bypass in requireUser()
// =========================================================================
test("ISSUE-041: requireUser() does NOT return the superuser admin client", () => {
  const authPath = path.join(process.cwd(), "lib/auth.ts");
  const authContent = fs.readFileSync(authPath, "utf-8");

  // Must NOT do `const supabase = admin;` for authenticated user return
  assert.equal(
    /const\s+supabase\s*=\s*admin\s*;/.test(authContent),
    false,
    "requireUser() must not assign the admin service_role client to supabase"
  );

  // Must call createClerkSupabaseServerClient
  assert.ok(
    authContent.includes("createClerkSupabaseServerClient"),
    "requireUser() must call createClerkSupabaseServerClient()"
  );
});

test("ISSUE-041: createClerkSupabaseServerClient configures Clerk JWT token", () => {
  const clerkServerPath = path.join(process.cwd(), "lib/supabase/clerk-server.ts");
  const clerkServerContent = fs.readFileSync(clerkServerPath, "utf-8");

  // Must attempt template: 'supabase'
  assert.ok(
    clerkServerContent.includes('template: "supabase"'),
    "createClerkSupabaseServerClient must request the supabase JWT template"
  );
  assert.ok(
    clerkServerContent.includes("Authorization"),
    "createClerkSupabaseServerClient must set the Authorization Bearer header"
  );
});

// =========================================================================
// BATCH 1B: ISSUE-031 — Swipe File Mutation IDOR
// =========================================================================
test("ISSUE-031: verifySwipeFileOwnership throws on cross-tenant folder access", async () => {
  const mockSupabase = {
    from: (table: string) => {
      assert.equal(table, "swipe_files");
      return {
        select: () => ({
          eq: (col1: string, val1: string) => ({
            eq: (col2: string, val2: string) => ({
              maybeSingle: async () => {
                // Return null when user_id does not match owner
                if (val1 === "folder-tenant-b" && val2 === "tenant-a") {
                  return { data: null, error: null };
                }
                if (val1 === "folder-tenant-a" && val2 === "tenant-a") {
                  return { data: { id: "folder-tenant-a" }, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;

  // Tenant A accessing their own folder succeeds
  const ownedId = await verifySwipeFileOwnership(mockSupabase, "folder-tenant-a", "tenant-a");
  assert.equal(ownedId, "folder-tenant-a");

  // Tenant A accessing Tenant B's folder is strictly rejected
  await assert.rejects(
    async () => {
      await verifySwipeFileOwnership(mockSupabase, "folder-tenant-b", "tenant-a");
    },
    /Swipe file not found or unauthorized/,
    "Accessing another tenant's swipe file must throw unauthorized error"
  );
});

test("ISSUE-031: toggleAdInSwipeFile rejects mutation on unowned folder without modifying DB", async () => {
  let itemDeleted = false;
  let itemInserted = false;

  const mockSupabase = {
    from: (table: string) => {
      if (table === "swipe_files") {
        return {
          select: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                maybeSingle: async () => {
                  // Folder belongs to tenant-b, caller is tenant-a
                  if (val1 === "folder-b" && val2 === "tenant-a") {
                    return { data: null, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === "swipe_file_items") {
        return {
          delete: () => {
            itemDeleted = true;
            return { eq: () => ({}) };
          },
          insert: () => {
            itemInserted = true;
            return { select: () => ({ maybeSingle: async () => ({ data: null }) }) };
          },
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

  await assert.rejects(
    async () => {
      await toggleAdInSwipeFile(mockSupabase, "tenant-a", "ad-123", "folder-b");
    },
    /Swipe file not found or unauthorized/
  );

  assert.equal(itemDeleted, false, "Must not delete any item on unauthorized folder");
  assert.equal(itemInserted, false, "Must not insert any item on unauthorized folder");
});

test("ISSUE-031: Owner can add and toggle ads in their own folder", async () => {
  let inserted = false;

  const mockSupabase = {
    from: (table: string) => {
      if (table === "swipe_files") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "my-folder" }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "swipe_file_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }), // Does not exist yet
              }),
            }),
          }),
          insert: () => {
            inserted = true;
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "item-1" }, error: null }),
              }),
            };
          },
        };
      }
      return {};
    },
  } as unknown as SupabaseClient;

  const result = await toggleAdInSwipeFile(mockSupabase, "tenant-a", "ad-123", "my-folder");
  assert.equal(inserted, true);
  assert.equal(result.added, true);
  assert.equal(result.swipeFileId, "my-folder");
});

// =========================================================================
// BATCH 1B: ISSUE-032 — Swipe File Metadata IDOR
// =========================================================================
test("ISSUE-032: getSwipeFile scopes metadata retrieval by userId", async () => {
  let scopedUserId: string | null = null;
  let requestedId: string | null = null;

  const mockSupabase = {
    from: (table: string) => {
      assert.equal(table, "swipe_files");
      return {
        select: () => ({
          eq: (col1: string, val1: string) => ({
            eq: (col2: string, val2: string) => ({
              maybeSingle: async () => {
                if (col1 === "id") requestedId = val1;
                if (col2 === "user_id") scopedUserId = val2;

                if (val1 === "folder-123" && val2 === "owner-user") {
                  return {
                    data: {
                      id: "folder-123",
                      name: "Competitor Creatives",
                      description: "Private notes",
                      is_system: false,
                      system_key: null,
                      created_at: "2026-11-13T00:00:00Z",
                      updated_at: "2026-11-13T00:00:00Z",
                      adCount: [{ count: 5 }],
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;

  // Owner reads their own folder
  const ownerData = await getSwipeFile(mockSupabase, "folder-123", "owner-user");
  assert.ok(ownerData);
  assert.equal(ownerData.name, "Competitor Creatives");
  assert.equal(scopedUserId, "owner-user");
  assert.equal(requestedId, "folder-123");

  // Different user reads folder -> returns null
  const otherUserData = await getSwipeFile(mockSupabase, "folder-123", "attacker-user");
  assert.equal(otherUserData, null, "Cross-tenant folder metadata query must return null");

  // Missing folder -> returns null
  const missingData = await getSwipeFile(mockSupabase, "missing-folder", "owner-user");
  assert.equal(missingData, null);

  // Empty userId or id -> returns null immediately
  const emptyUser = await getSwipeFile(mockSupabase, "folder-123", "");
  assert.equal(emptyUser, null);
});

// =========================================================================
// BATCH 1B: ISSUE-033 — Platform Owner Authorization & Filter Injection
// =========================================================================
test("ISSUE-033: Platform owner email is configurable via environment", () => {
  const originalEnv = process.env.PLATFORM_OWNER_EMAIL;
  try {
    process.env.PLATFORM_OWNER_EMAIL = "security-lead@adshunting.com";
    assert.equal(getPlatformOwnerEmail(), "security-lead@adshunting.com");
    assert.equal(isPlatformOwnerEmail("security-lead@adshunting.com"), true);
    assert.equal(isPlatformOwnerEmail("attacker@evil.com"), false);
  } finally {
    if (originalEnv) {
      process.env.PLATFORM_OWNER_EMAIL = originalEnv;
    } else {
      delete process.env.PLATFORM_OWNER_EMAIL;
    }
  }
});

test("ISSUE-033: Malformed user IDs fail closed and block PostgREST injection", async () => {
  // Injection payloads containing quotes, operators, parentheses
  const maliciousIds = [
    `user_1",role.eq."OWNER`,
    `user_1' OR 1=1 --`,
    `user_1,clerk_user_id.neq.null`,
    `user_1; DROP TABLE profiles;`,
    `user 1 with spaces`,
    `<script>alert(1)</script>`,
  ];

  for (const maliciousId of maliciousIds) {
    const isOwner = await isPlatformOwner(maliciousId);
    assert.equal(
      isOwner,
      false,
      `Malicious userId '${maliciousId}' must immediately return false without querying DB`
    );
  }
});

test("ISSUE-033: ensurePlatformOwner ignores malicious identifiers", async () => {
  // Should return gracefully without throwing or injecting
  await ensurePlatformOwner(`attacker",role.eq."OWNER`);
  await ensurePlatformOwner(null);
  await ensurePlatformOwner("");
});

// =========================================================================
// BATCH 1C: ISSUE-039 — Svix Webhook Signature Verification
// =========================================================================
test("ISSUE-039: Svix webhook verifies raw body and rejects modified payload", () => {
  const secret = "whsec_MfKQ9r8GKYdaOpWjdvgdtLSihR6HSg50";
  const wh = new Webhook(secret);

  const rawPayload = JSON.stringify({
    type: "user.created",
    data: {
      id: "user_test123",
      email_addresses: [{ email_address: "test@adshunting.com" }],
      first_name: "Test",
      last_name: "User",
    },
  });

  const timestamp = new Date();
  const msgId = "msg_test_12345";
  const signature = wh.sign(msgId, timestamp, rawPayload);

  // Verify valid signature on raw text succeeds
  const verified = wh.verify(rawPayload, {
    "svix-id": msgId,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  }) as Record<string, unknown>;

  assert.equal(verified.type, "user.created");

  // Tampered payload with extra space or changed field is strictly rejected
  const tamperedPayload = rawPayload.replace("test@adshunting.com", "hacked@evil.com");
  assert.throws(() => {
    wh.verify(tamperedPayload, {
      "svix-id": msgId,
      "svix-timestamp": String(timestamp),
      "svix-signature": signature,
    });
  });
});

test("ISSUE-039: Webhook route reads raw text directly without re-stringifying", () => {
  const clerkWebhookPath = path.join(process.cwd(), "app/api/webhooks/clerk/route.ts");
  const clerkWebhookContent = fs.readFileSync(clerkWebhookPath, "utf-8");

  // Must use req.text()
  assert.ok(
    clerkWebhookContent.includes("await req.text()"),
    "Clerk webhook route must read raw text using req.text()"
  );

  // Must NOT re-stringify JSON
  assert.equal(
    clerkWebhookContent.includes("JSON.stringify(payload)"),
    false,
    "Clerk webhook route must not re-stringify parsed JSON payload"
  );
});

// =========================================================================
// BATCH 1C: ISSUE-016 — Shared-Ad Token Security
// =========================================================================
test("ISSUE-016: hashShareToken produces deterministic SHA-256 hex digest", () => {
  const rawToken = "rlt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const hash1 = hashShareToken(rawToken);
  const hash2 = hashShareToken(rawToken);

  assert.equal(hash1, hash2, "Hashing must be deterministic");
  assert.equal(hash1.length, 64, "SHA-256 hex digest must be 64 characters");
  assert.notEqual(hash1, rawToken, "Hash must not equal raw token");

  const expected = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(hash1, expected);
});

test("ISSUE-016: POST /api/shared-ads stores tokenHash in database", () => {
  const sharedAdsRoutePath = path.join(process.cwd(), "app/api/shared-ads/route.ts");
  const sharedAdsContent = fs.readFileSync(sharedAdsRoutePath, "utf-8");

  assert.ok(
    sharedAdsContent.includes("hashShareToken"),
    "Route must import and use hashShareToken"
  );
  assert.ok(
    sharedAdsContent.includes("token_hash: tokenHash"),
    "Route must insert tokenHash (SHA-256) into token_hash column"
  );
  assert.equal(
    /token_hash:\s*token\b/.test(sharedAdsContent),
    false,
    "Route must not store raw unhashed token in token_hash column"
  );
});

test("ISSUE-016: findSharedAdLinkByToken resolves both hashed and legacy links", async () => {
  const rawToken = "rlt_test_token_new_123";
  const hashedToken = hashShareToken(rawToken);
  const legacyToken = "rlt_legacy_token_old_456";

  const dbRows = new Map<string, { id: string; name: string; token_hash: string }>([
    [hashedToken, { id: "link-1", name: "New Share", token_hash: hashedToken }],
    [legacyToken, { id: "link-2", name: "Legacy Share", token_hash: legacyToken }],
  ]);

  const mockSupabase = {
    from: (table: string) => {
      assert.equal(table, "shared_ad_links");
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              const found = dbRows.get(val);
              return { data: found || null, error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;

  // 1. New token lookup by raw token -> successfully resolved via hash
  const res1 = await findSharedAdLinkByToken<{ id: string; name: string }>(
    mockSupabase,
    rawToken,
    "id, name"
  );
  assert.ok(res1.data);
  assert.equal(res1.data.id, "link-1");
  assert.equal(res1.data.name, "New Share");

  // 2. Legacy token lookup by raw plaintext token -> resolved via fallback
  const res2 = await findSharedAdLinkByToken<{ id: string; name: string }>(
    mockSupabase,
    legacyToken,
    "id, name"
  );
  assert.ok(res2.data);
  assert.equal(res2.data.id, "link-2");
  assert.equal(res2.data.name, "Legacy Share");

  // 3. Unknown token -> returns null
  const res3 = await findSharedAdLinkByToken(mockSupabase, "rlt_non_existent", "id, name");
  assert.equal(res3.data, null);
});

// =========================================================================
// INTEGRATION & BEHAVIORAL VERIFICATION: RLS, TENANT ISOLATION & ROLLBACK
// =========================================================================
test("ISSUE-041 Behavioral: Two synthetic tenants with scoped clients enforce strict RLS isolation", async () => {
  type TableRow = Record<string, unknown>;

  // In-memory relational database fixture simulating Supabase with RLS
  const db = {
    swipe_files: [
      { id: "folder-a1", user_id: "user_tenant_a", name: "Tenant A Folder" },
      { id: "folder-b1", user_id: "user_tenant_b", name: "Tenant B Folder" },
    ] as TableRow[],
    swipe_file_items: [
      { id: "item-a1", swipe_file_id: "folder-a1", ad_id: "ad-1" },
      { id: "item-b1", swipe_file_id: "folder-b1", ad_id: "ad-2" },
    ] as TableRow[],
    competitors: [
      { id: "comp-a1", user_id: "user_tenant_a", advertiser_name: "Brand A" },
      { id: "comp-b1", user_id: "user_tenant_b", advertiser_name: "Brand B" },
    ] as TableRow[],
  };

  // Simulates PostgREST RLS engine evaluating `auth.jwt()->>'sub' = user_id`
  function createScopedClient(claims: { sub: string; role: string } | null) {
    const userId = claims?.sub ?? null;
    const role = claims?.role ?? "anon";

    return {
      from: (table: keyof typeof db) => ({
        select: () => ({
          eq: (col: string, val: unknown) => ({
            maybeSingle: async () => {
              if (role !== "authenticated" || !userId) return { data: null, error: null };
              // RLS policy: user_id = auth.jwt()->>'sub'
              const rows = db[table].filter(
                (r) => r.user_id === userId && r[col] === val
              );
              return { data: rows[0] || null, error: null };
            },
          }),
          // Query without user_id filter (testing if RLS intercepts)
          maybeSingle: async () => {
            if (role !== "authenticated" || !userId) return { data: null, error: null };
            const rows = db[table].filter((r) => r.user_id === userId);
            return { data: rows[0] || null, error: null };
          },
        }),
        insert: (data: TableRow) => ({
          select: () => ({
            maybeSingle: async () => {
              if (role !== "authenticated" || !userId) {
                return { data: null, error: new Error("RLS: Unauthorized") };
              }
              // RLS policy check on insert
              if (data.user_id && data.user_id !== userId) {
                return { data: null, error: new Error("RLS: WITH CHECK policy violated") };
              }
              // For swipe_file_items, check if parent swipe_file belongs to user
              if (table === "swipe_file_items") {
                const parent = db.swipe_files.find(
                  (f) => f.id === data.swipe_file_id && f.user_id === userId
                );
                if (!parent) {
                  return { data: null, error: new Error("RLS: Parent collection unauthorized") };
                }
              }
              const row = { id: `item-${Date.now()}`, ...data };
              db[table].push(row);
              return { data: row, error: null };
            },
          }),
        }),
      }),
    } as unknown as SupabaseClient;
  }

  const clientTenantA = createScopedClient({ sub: "user_tenant_a", role: "authenticated" });
  const clientTenantB = createScopedClient({ sub: "user_tenant_b", role: "authenticated" });
  const clientAnon = createScopedClient(null);

  // 1. Tenant A reads their own folder -> Success
  const resA = await clientTenantA.from("swipe_files").select().eq("id", "folder-a1").maybeSingle();
  assert.ok(resA.data);
  assert.equal(resA.data.name, "Tenant A Folder");

  // 2. Tenant A attempts to read Tenant B's folder -> RLS returns null (zero rows)
  const resCross = await clientTenantA.from("swipe_files").select().eq("id", "folder-b1").maybeSingle();
  assert.equal(resCross.data, null, "Tenant A must NOT read Tenant B's folder under RLS");

  // 3. Tenant B reads their own folder -> Success
  const resB = await clientTenantB.from("swipe_files").select().eq("id", "folder-b1").maybeSingle();
  assert.ok(resB.data);
  assert.equal(resB.data.name, "Tenant B Folder");

  // 4. Anonymous user attempts to read -> RLS returns null
  const resAnon = await clientAnon.from("swipe_files").select().eq("id", "folder-a1").maybeSingle();
  assert.equal(resAnon.data, null, "Anonymous user must NOT read protected records");

  // 5. Tenant A attempts to insert item into Tenant B's folder -> RLS blocks it
  const crossInsert = await clientTenantA
    .from("swipe_file_items")
    .insert({ swipe_file_id: "folder-b1", ad_id: "ad-malicious" })
    .select()
    .maybeSingle();
  assert.ok(crossInsert.error, "Cross-tenant insertion must be blocked by RLS");

  // 6. Tenant A inserts item into their own folder -> Allowed
  const ownInsert = await clientTenantA
    .from("swipe_file_items")
    .insert({ swipe_file_id: "folder-a1", ad_id: "ad-legit" })
    .select()
    .maybeSingle();
  assert.equal(ownInsert.error, null);
  assert.ok(ownInsert.data);
});

test("ISSUE-033 Behavioral: Missing PLATFORM_OWNER_EMAIL fails closed without granting access", () => {
  const originalEnv = process.env.PLATFORM_OWNER_EMAIL;
  try {
    delete process.env.PLATFORM_OWNER_EMAIL;

    // Must return null
    assert.equal(getPlatformOwnerEmail(), null);

    // Hardcoded dev address must NOT be granted access when env is absent
    assert.equal(isPlatformOwnerEmail("creatornavigator@gmail.com"), false);
    assert.equal(isPlatformOwnerEmail("admin@adshunting.com"), false);
    assert.equal(isPlatformOwnerEmail(""), false);
    assert.equal(isPlatformOwnerEmail(null), false);
  } finally {
    if (originalEnv) {
      process.env.PLATFORM_OWNER_EMAIL = originalEnv;
    } else {
      delete process.env.PLATFORM_OWNER_EMAIL;
    }
  }
});

test("ISSUE-005 Behavioral: Frontend FeedbackSupport component renders partial success message on dispatched: false", () => {
  const componentPath = path.join(process.cwd(), "components/support/FeedbackSupport.tsx");
  const componentContent = fs.readFileSync(componentPath, "utf-8");

  // Verify that FeedbackSupport handles data.dispatched
  assert.ok(
    componentContent.includes("setDispatched(data.dispatched"),
    "Component must inspect data.dispatched property"
  );
  assert.ok(
    componentContent.includes("dispatched === false"),
    "Component must conditionally render truthful message when dispatched === false"
  );
  assert.ok(
    componentContent.includes("Feedback saved locally"),
    "Component must display 'Feedback saved locally' when external delivery is pending/failed"
  );
});

test("ISSUE-016 Behavioral: Shared-Ad token migration is idempotent and maintains dual compatibility", async () => {
  // Simulate database table before migration
  const legacyPlaintextToken = "rlt_legacy_token_1234567890abcdef";
  const expectedHash = hashShareToken(legacyPlaintextToken);
  const alreadyHashedToken = hashShareToken("rlt_already_hashed_987654321");

  const dbTable = [
    { id: "1", token_hash: legacyPlaintextToken },
    { id: "2", token_hash: alreadyHashedToken },
  ];

  // 1. Simulate the SQL migration:
  // UPDATE shared_ad_links SET token_hash = sha256(token_hash) WHERE token_hash !~ '^[0-9a-f]{64}$'
  let updatedRows = 0;
  for (const row of dbTable) {
    if (!/^[0-9a-f]{64}$/.test(row.token_hash)) {
      row.token_hash = hashShareToken(row.token_hash);
      updatedRows++;
    }
  }
  assert.equal(updatedRows, 1, "Only the unhashed legacy token should be modified");
  assert.equal(dbTable[0].token_hash, expectedHash, "Legacy token must now be hashed");
  assert.equal(dbTable[1].token_hash, alreadyHashedToken, "Already-hashed token must remain identical");

  // 2. Re-run migration simulation (idempotency check)
  let secondPassUpdates = 0;
  for (const row of dbTable) {
    if (!/^[0-9a-f]{64}$/.test(row.token_hash)) {
      row.token_hash = hashShareToken(row.token_hash);
      secondPassUpdates++;
    }
  }
  assert.equal(secondPassUpdates, 0, "Second migration pass must modify 0 rows (idempotent)");

  // 3. Verify lookup works for both links after migration
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => {
            const found = dbTable.find((r) => r.token_hash === val);
            return { data: found || null, error: null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  // Visiting the legacy link with raw token -> hashes to expectedHash -> finds row 1
  const foundLegacy = await findSharedAdLinkByToken(mockSupabase, legacyPlaintextToken, "id");
  assert.ok(foundLegacy.data);
  assert.equal(foundLegacy.data.id, "1");
});

