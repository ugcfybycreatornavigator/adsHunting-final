export type AdFormat = 'image' | 'video' | 'carousel';
export type AdStatus = 'active' | 'inactive';

export interface WorkflowAd {
  id: string;
  brand: string;
  format: AdFormat;
  status: AdStatus;
  startedAt: string;
  thumbnail: string;
  primaryText: string;
  landingPageUrl?: string;
  signals?: {
    creativeFatigue: string;
    scaling: string;
  };
}

export const workflowAds: WorkflowAd[] = [
  {
    id: 'ad_fashion_1',
    brand: 'Aether Athletics',
    format: 'image',
    status: 'active',
    startedAt: '2026-08-10',
    thumbnail: '/brand/creatives/creative_fashion_01.jpg',
    primaryText: 'Engineered for the urban runner. The new Aether Velocity combines performance with minimalist street aesthetic.',
    landingPageUrl: 'aetherathletics.in/velocity',
    signals: {
      creativeFatigue: 'Low',
      scaling: 'High'
    }
  },
  {
    id: 'ad_beauty_1',
    brand: 'Veda Botanics',
    format: 'video',
    status: 'active',
    startedAt: '2026-08-12',
    thumbnail: '/brand/creatives/creative_beauty_01.jpg',
    primaryText: 'The secret to my morning glow? Saffron & Ayurveda. Watch how I get ready in 5 minutes.',
    landingPageUrl: 'vedabotanics.in/glow',
    signals: {
      creativeFatigue: 'Medium',
      scaling: 'Steady'
    }
  },
  {
    id: 'ad_tech_1',
    brand: 'Aura Sound',
    format: 'image',
    status: 'active',
    startedAt: '2026-08-14',
    thumbnail: '/brand/creatives/creative_tech_01.jpg',
    primaryText: 'Immersive sound. Minimalist design. Meet the Aura One wireless headphones.',
    landingPageUrl: 'aurasound.in/one',
    signals: {
      creativeFatigue: 'Low',
      scaling: 'High'
    }
  },
  {
    id: 'ad_fitness_1',
    brand: 'Form & Function',
    format: 'carousel',
    status: 'inactive',
    startedAt: '2026-07-01',
    thumbnail: '/brand/creatives/creative_fitness_01.jpg',
    primaryText: 'Train harder. Recover faster. Premium activewear designed for the modern athlete.',
    landingPageUrl: 'formfunction.in/shop',
    signals: {
      creativeFatigue: 'High',
      scaling: 'Declining'
    }
  },
  {
    id: 'ad_food_1',
    brand: 'Svasta Foods',
    format: 'image',
    status: 'active',
    startedAt: '2026-08-15',
    thumbnail: '/brand/creatives/creative_food_01.jpg',
    primaryText: 'Guilt-free snacking just got a major upgrade. Artisanal roasted makhana, crafted in small batches.',
    landingPageUrl: 'svastafoods.in/makhana',
    signals: {
      creativeFatigue: 'Low',
      scaling: 'Steady'
    }
  }
];
