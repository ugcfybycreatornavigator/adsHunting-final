// Explicit opt-in smoke test: 1 Foreplay ad, then normal ingestion and a real DB reread.
// No logo/name lookup requests. Run with --fetch-one-ad to authorize the live ad request.
require('dotenv').config({path: '.env.local', quiet: true});
require('../tests/register-typescript.cjs');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === 'server-only') return {};
  return originalLoad.call(this, id, ...args);
};
const { createClient } = require('@supabase/supabase-js');
const { dbAdToNormalized } = require('../lib/catalog');
const { brandFromRow, resolveAdIdentities } = require('../lib/advertiser-identity');
const { normalizeForeplayAd, ForeplayProvider } = require('../lib/providers/foreplay');
const { persistNormalizedAds } = require('../lib/ads-persistence');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const { AdCard } = require('../components/ad-card');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const render = ad => renderToStaticMarkup(React.createElement(AdCard, {ad, onOpen(){}, onSave(){}, onShare(){}}));
(async () => {
  const {data: suggestions, error} = await db.rpc('get_search_suggestions', {search_query: 'nike', max_limit: 5});
  if(error) throw new Error(error.message);
  const suggestion = suggestions.find(s => s.label === 'Nike');
  assert.ok(suggestion);
  const {data: rows, error: readError} = await db.from('ads').select('*').eq('advertiser_id', suggestion.id).limit(25);
  if(readError) throw new Error(readError.message);
  const brand = rows.map(brandFromRow).find(Boolean);
  assert.ok(brand);
  const ads = resolveAdIdentities(rows.map(dbAdToNormalized), [brand], brand, brand.id);
  assert.ok(ads.length);
  assert.ok(ads.every(ad => ad.advertiser.name === 'Nike'));
  assert.ok(render(ads[0]).includes('Nike'));
  const refreshed = await db.from('ads').select('*').eq('id', rows[0].id).single();
  if(refreshed.error) throw new Error(refreshed.error.message);
  assert.ok(render(dbAdToNormalized(refreshed.data)).includes('Nike'));
  const report = { searchedBrand: 'Nike', selectedBrand: brand.name, provider: 'catalog', providerAdvertiserId: brand.providerAdvertiserId,
    normalizedAdvertiserName: ads[0].advertiser.name, persistedAdvertiserName: refreshed.data.advertiser_name,
    uiAdvertiserName: 'Nike (actual AdCard server render)', adsReturned: ads.length, refresh: 'Nike', providerCalls: 0 };
  console.log(JSON.stringify(report));
  if(process.argv.includes('--fetch-one-ad')) {
    // The prior live discovery payload is required; never invent a provider mapping.
    const sample = JSON.parse(fs.readFileSync('/tmp/adshunting-foreplay-live.json', 'utf8')).data[0];
    const discovered = normalizeForeplayAd(sample);
    const selected = {id: discovered.advertiser.id, providerAdvertiserId: discovered.advertiser.id,
      name: discovered.advertiser.name, provider: 'foreplay', logoUrl: discovered.advertiser.logoUrl};
    assert.ok(selected.id && selected.name);
    const originalFetch = globalThis.fetch;
    let requestIdentity;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if(url.hostname === 'public.api.foreplay.co') {
        assert.equal(url.pathname, '/api/brand/getAdsByBrandId');
        assert.equal(url.searchParams.get('brand_ids'), selected.id);
        assert.equal(url.searchParams.has('query'), false);
        url.searchParams.set('limit', '1');
        requestIdentity = selected.id;
        return originalFetch(url, init);
      }
      return originalFetch(input, init);
    };
    let result;
    try { result = await new ForeplayProvider(process.env.FOREPLAY_API_KEY).searchAds({brand: selected.id, selectedBrand: selected}); }
    finally {globalThis.fetch = originalFetch;}
    assert.equal(result.ads.length, 1);
    const resolved = resolveAdIdentities(result.ads, [], selected, selected.id);
    const persistence = await persistNormalizedAds(resolved);
    assert.equal(persistence.error, null);
    const reread = await db.from('ads').select('*').eq('canonical_ad_id', resolved[0].id).single();
    if(reread.error) throw new Error(reread.error.message);
    const final = dbAdToNormalized(reread.data);
    assert.equal(final.advertiser.name, selected.name);
    assert.ok(render(final).includes(selected.name));
    console.log(JSON.stringify({searchedBrand: 'Nike (keyword)', selectedBrand: selected.name, provider: 'foreplay', providerAdvertiserId: requestIdentity,
      providerReturnedName: result.ads[0].rawData.name, normalizedName: resolved[0].advertiser.name, persistedName: reread.data.advertiser_name,
      uiAdvertiserName: final.advertiser.name + ' (actual AdCard server render)', adsReturned: 1, refresh: final.advertiser.name}));
  }
})().catch(error => {console.error(error.message);process.exitCode = 1;});
