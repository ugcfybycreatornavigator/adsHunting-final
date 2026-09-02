export type AdFormat = 'image' | 'video' | 'carousel';
export type AdStatus = 'active' | 'inactive';

export interface DemoAd {
  id: string;
  brand: string;
  format: AdFormat;
  status: AdStatus;
  startedAt: string;
  thumbnail: string;
  primaryText: string;
}

const svg1 = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdfbf7" />
      <stop offset="100%" stop-color="#e8f3e2" />
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#g1)" />
  <text x="200" y="240" font-family="system-ui, sans-serif" font-size="36" font-weight="800" fill="#2a3f24" text-anchor="middle" letter-spacing="-1">Frido.</text>
  <text x="200" y="280" font-family="system-ui, sans-serif" font-size="18" font-weight="500" fill="#4a5d43" text-anchor="middle">Everyday Comfort</text>
</svg>`);

const svg2 = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4f5f3" />
      <stop offset="100%" stop-color="#dce8d6" />
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#g2)" />
  <text x="200" y="240" font-family="system-ui, sans-serif" font-size="36" font-weight="800" fill="#2a3f24" text-anchor="middle" letter-spacing="-1">Walk Better</text>
  <text x="200" y="280" font-family="system-ui, sans-serif" font-size="18" font-weight="500" fill="#4a5d43" text-anchor="middle">By Frido</text>
</svg>`);

const svg3 = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <rect width="400" height="500" fill="#fcfcfa" />
  <circle cx="200" cy="200" r="80" fill="#eef4ec" />
  <text x="200" y="340" font-family="system-ui, sans-serif" font-size="32" font-weight="800" fill="#2a3f24" text-anchor="middle" letter-spacing="-1">Frido Active</text>
</svg>`);

const svg4 = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="g4" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#g4)" />
  <text x="200" y="250" font-family="system-ui, sans-serif" font-size="42" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-1">FRIDO</text>
  <text x="200" y="290" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#ecfdf5" text-anchor="middle" letter-spacing="2">INDIA</text>
</svg>`);

export const demoAds: DemoAd[] = [
  {
    id: 'ad_frido_1',
    brand: 'Frido',
    format: 'video',
    status: 'active',
    startedAt: '2026-08-10',
    thumbnail: `data:image/svg+xml;utf8,${svg1}`,
    primaryText: 'The best insoles for everyday comfort.'
  },
  {
    id: 'ad_frido_2',
    brand: 'Frido',
    format: 'image',
    status: 'active',
    startedAt: '2026-08-12',
    thumbnail: `data:image/svg+xml;utf8,${svg2}`,
    primaryText: 'Upgrade your daily walk with ultimate support.'
  },
  {
    id: 'ad_frido_3',
    brand: 'Frido',
    format: 'carousel',
    status: 'active',
    startedAt: '2026-08-14',
    thumbnail: `data:image/svg+xml;utf8,${svg3}`,
    primaryText: 'Explore our latest collection of orthopedic insoles.'
  },
  {
    id: 'ad_frido_4',
    brand: 'Frido India',
    format: 'video',
    status: 'inactive',
    startedAt: '2026-07-01',
    thumbnail: `data:image/svg+xml;utf8,${svg4}`,
    primaryText: 'Experience the difference. Available now in India.'
  }
];
