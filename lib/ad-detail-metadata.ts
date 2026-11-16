import type { NormalizedAd } from "@/lib/types";

type Detail = NonNullable<NormalizedAd["detail"]>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function textList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => text(item, 240)).filter((item): item is string => Boolean(item)))).slice(0, limit);
}

export function normalizeBusinessContact(emailValue: unknown, provenanceValue: unknown, verifiedAtValue?: unknown): Detail["businessContact"] {
  const email = text(emailValue, 320)?.toLowerCase() ?? null;
  const provenance = text(provenanceValue, 500);
  if (!email || !provenance || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const verifiedAtText = text(verifiedAtValue, 40);
  const verifiedAt = verifiedAtText && !Number.isNaN(Date.parse(verifiedAtText)) ? new Date(verifiedAtText).toISOString() : null;
  return { email, provenance, verifiedAt };
}

export function normalizeTranscript(value: unknown): Detail["transcript"] {
  const input = record(value);
  if (!input || !["available", "processing", "unavailable", "failed"].includes(String(input.status))) return null;
  const segments = Array.isArray(input.segments) ? input.segments.flatMap((candidate) => {
    const segment = record(candidate);
    const segmentText = text(segment?.text, 4000);
    const startSeconds = Number(segment?.startSeconds);
    const endSeconds = segment?.endSeconds == null ? null : Number(segment.endSeconds);
    if (!segmentText || !Number.isFinite(startSeconds) || startSeconds < 0 || (endSeconds != null && (!Number.isFinite(endSeconds) || endSeconds < startSeconds))) return [];
    return [{ startSeconds: Math.min(startSeconds, 86_400), endSeconds: endSeconds == null ? null : Math.min(endSeconds, 86_400), text: segmentText }];
  }).slice(0, 2000) : [];
  return {
    status: input.status as NonNullable<Detail["transcript"]>["status"],
    language: text(input.language, 80),
    provenance: text(input.provenance, 500),
    segments,
  };
}

export function normalizeCreativeAnalysis(value: unknown): Detail["analysis"] {
  const input = record(value);
  if (!input || !["complete", "partial", "not_analyzed", "failed"].includes(String(input.status))) return null;
  return {
    status: input.status as NonNullable<Detail["analysis"]>["status"],
    provenance: text(input.provenance, 500),
    persona: text(input.persona, 1000),
    painPoints: textList(input.painPoints),
    sellingPoints: textList(input.sellingPoints),
    tags: textList(input.tags, 24),
    language: text(input.language, 80),
  };
}

export function normalizeAdDetail(value: unknown): Detail | undefined {
  const input = record(value);
  if (!input) return undefined;
  const contact = record(input.businessContact);
  const detail: Detail = {
    businessContact: contact ? normalizeBusinessContact(contact.email, contact.provenance, contact.verifiedAt) : null,
    transcript: normalizeTranscript(input.transcript),
    analysis: normalizeCreativeAnalysis(input.analysis),
  };
  return detail.businessContact || detail.transcript || detail.analysis ? detail : undefined;
}
