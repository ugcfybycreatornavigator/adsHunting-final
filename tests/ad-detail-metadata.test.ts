import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdDetail, normalizeBusinessContact, normalizeCreativeAnalysis, normalizeTranscript } from "@/lib/ad-detail-metadata";

test("business contacts require a valid email and provenance", () => {
  assert.equal(normalizeBusinessContact("owner@example.com", null), null);
  assert.equal(normalizeBusinessContact("guessed-address", "provider"), null);
  assert.deepEqual(normalizeBusinessContact(" Sales@Example.com ", "Public company contact page"), {
    email: "sales@example.com",
    provenance: "Public company contact page",
    verifiedAt: null,
  });
});

test("transcript normalization rejects invalid timings and bounds content", () => {
  const transcript = normalizeTranscript({ status: "available", segments: [
    { startSeconds: 2, endSeconds: 4, text: " Opening hook " },
    { startSeconds: -1, text: "invalid" },
    { startSeconds: 8, endSeconds: 5, text: "invalid" },
  ] });
  assert.equal(transcript?.segments.length, 1);
  assert.equal(transcript?.segments[0].text, "Opening hook");
});

test("analysis fields are sanitized and deduplicated without inventing values", () => {
  const analysis = normalizeCreativeAnalysis({ status: "partial", painPoints: ["Cost", "Cost", ""], sellingPoints: ["Fast setup"], tags: ["Video", "Video"] });
  assert.deepEqual(analysis?.painPoints, ["Cost"]);
  assert.deepEqual(analysis?.tags, ["Video"]);
  assert.equal(analysis?.persona, null);
});

test("empty detail metadata remains absent", () => {
  assert.equal(normalizeAdDetail({}), undefined);
});
