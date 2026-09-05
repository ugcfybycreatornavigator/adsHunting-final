import type { BrandIdentity, NormalizedAd } from "./types";
import type { DatabaseAdRow } from "./catalog";
import { identityProvider, realAdvertiserName, resolveAdvertiser, matchingBrand } from "../supabase/functions/_shared/ads/advertiser-identity";
export { identityProvider, realAdvertiserName, resolveAdvertiser, matchingBrand };

export function brandFromRow(row: Pick<DatabaseAdRow, "advertiser_id" | "advertiser_name" | "advertiser_avatar_url" | "advertiser_profile_url" | "source" | "raw_data" | "refined_data">): BrandIdentity | undefined {
  const provider = identityProvider(row.source);
  const name = realAdvertiserName(row.advertiser_name, row.advertiser_id);
  if (!provider || !name || !row.advertiser_id || row.advertiser_id === "unknown") return undefined;
  const refined = row.refined_data as unknown as NormalizedAd | null;
  // The existing catalog advertiser_id is the provider ID, not a separate brand table ID.
  return { id: row.advertiser_id, name, provider, providerAdvertiserId: row.advertiser_id,
    logoUrl: row.advertiser_avatar_url || refined?.advertiser?.logoUrl || null,
    profileUrl: row.advertiser_profile_url || refined?.advertiser?.pageUrl || null,
    domain: refined?.advertiser?.domain || null };
}

export function resolveAdIdentities(ads: NormalizedAd[], canonical: BrandIdentity[], selected?: BrandIdentity, requestedId?: string): NormalizedAd[] {
  const byId = new Map(canonical.map(brand => [`${brand.provider}:${brand.providerAdvertiserId}`, brand]));
  return ads.filter(ad => !requestedId || (selected
    ? Boolean(matchingBrand(selected, ad.provider.discoveryProvider, requestedId, ad.advertiser.id))
    : ad.advertiser.id === requestedId))
    .map(ad => {
      const provider = identityProvider(ad.provider.discoveryProvider);
      const raw = ad.rawData;
      // Re-establish provider precedence when a normalizer already filled selected context.
      const providerName = raw ? realAdvertiserName(provider === "foreplay" ? raw.name : raw.page_name, ad.advertiser.id) : ad.advertiser.name;
      const advertiser = { ...ad.advertiser, name: providerName };
      if (raw && ad.provider.discoveryProvider === "meta_official") {
        advertiser.logoUrl = null;
        advertiser.pageUrl = null;
        advertiser.domain = null;
      }
      return { ...ad, advertiser: resolveAdvertiser(advertiser,
        byId.get(`${provider}:${ad.advertiser.id}`),
        matchingBrand(selected, ad.provider.discoveryProvider, requestedId, ad.advertiser.id), ad.advertiser) };
    });
}
