/** Shared by the Next and Edge ingestion paths; no provider calls or DB lookups. */
export type BrandIdentity = {
  id: string;
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  profileUrl?: string | null;
  provider: "meta" | "foreplay";
  providerAdvertiserId: string;
};

export function realAdvertiserName(value: unknown, id?: string | null): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name === id || /^\d+$/.test(name) ||
      /^(unknown(?: brand| advertiser)?|advertiser|n\/a|null|undefined)$/i.test(name)) return null;
  return name;
}

export function identityProvider(source: string): "meta" | "foreplay" | null {
  if (["meta", "meta_official", "searchapi", "metaapi_io"].includes(source)) return "meta";
  return source === "foreplay" ? "foreplay" : null;
}

type Advertiser = {
  id: string | null; name: string | null; displayName?: string | null;
  logoUrl: string | null; pageUrl: string | null; domain: string | null;
};

export function resolveAdvertiser<T extends Advertiser>(
  advertiser: T,
  canonical?: BrandIdentity | null,
  selected?: BrandIdentity | null,
  persisted?: Partial<T> | null,
): T {
  const name = [advertiser.name, canonical?.name, selected?.name, persisted?.name]
    .map(value => realAdvertiserName(value, advertiser.id)).find(Boolean) || null;
  return {
    ...advertiser, name, displayName: name,
    logoUrl: advertiser.logoUrl || canonical?.logoUrl || selected?.logoUrl || persisted?.logoUrl || null,
    pageUrl: advertiser.pageUrl || canonical?.profileUrl || selected?.profileUrl || persisted?.pageUrl || null,
    domain: advertiser.domain || canonical?.domain || selected?.domain || persisted?.domain || null,
  };
}

export function matchingBrand(brand: BrandIdentity | undefined, provider: string, requestedId?: string, returnedId?: string | null) {
  return brand && brand.provider === identityProvider(provider) && brand.id === requestedId &&
    brand.providerAdvertiserId === returnedId ? brand : undefined;
}
