import type { BrandIdentity } from "@/lib/types";
export type SearchSuggestion = {
  id: string; brand?: BrandIdentity;
  type: "brand" | "advertiser" | "keyword" | "category" | "recent";
  label: string; normalizedLabel: string; subtitle?: string; imageUrl?: string | null;
};
export const normalizeTerm = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase();
export function relatedToHistory(label: string, history: string[]) {
  const words = new Set(normalizeTerm(label).split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3));
  return history.some(term => normalizeTerm(term).split(/[^\p{L}\p{N}]+/u).some(word => words.has(word)));
}
export function recentTerms(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    if (typeof value !== "string" || !value.trim() || value.length > 160) return false;
    const key = normalizeTerm(value);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 5).map(value => value.trim());
}
export function rankSuggestions(items: SearchSuggestion[], query: string, history: string[], seed: string) {
  const q = normalizeTerm(query), seen = new Set<string>();
  const hash = (value: string) => [...value].reduce((n, char) => Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const score = (item: SearchSuggestion) => {
    const name = normalizeTerm(item.label);
    if (q) return name === q ? 0 : name.startsWith(q) ? 1 : 2;
    return history.some(term => normalizeTerm(term) === name) ? 0 : relatedToHistory(name, history) ? 1 : 2;
  };
  return items.filter(item => {
    const name = normalizeTerm(item.label);
    if (!name || seen.has(name)) return false;
    seen.add(name); return true;
  }).sort((a, b) => score(a) - score(b) || (q ? a.label.localeCompare(b.label) : hash(seed + a.id) - hash(seed + b.id))).slice(0, 8);
}
export const historyStorageKey = (userId: string) => `adshunting:search-history:${userId}`;
