const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

async function testQuality() {
  const apiKey = env['SEARCH_API_KEY_1'];
  // searchapi.io requires engine=meta_ad_library and q=shoes
  const url = \`https://www.searchapi.io/api/v1/search?engine=meta_ad_library&q=shoes&api_key=\${apiKey}\`;
  
  const start = Date.now();
  const res = await fetch(url);
  const data = await res.json();
  
  console.log('SearchAPI HTTP STATUS:', res.status);
  console.log('Raw results length:', data.ads ? data.ads.length : 0);
  
  if (data.ads && data.ads.length > 0) {
    let topAds = data.ads.slice(0, 5);
    topAds.forEach((ad, i) => {
      console.log(\`[Raw Ad \${i}]\`);
      console.log('  ID:', ad.ad_archive_id);
      console.log('  Page Name:', ad.page_name);
      console.log('  Page ID:', ad.page_id);
      console.log('  Title:', ad.title || ad.link_title);
      console.log('  Text:', (ad.text || '').substring(0, 50));
      console.log('  Start Date:', ad.start_date);
    });
  }
}

testQuality().catch(console.error);
