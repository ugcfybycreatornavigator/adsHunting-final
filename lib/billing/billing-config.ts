export type PlanConfig = {
  id: "scout" | "hunter" | "agency";
  name: string;
  audience: string;
  regularPrice?: number | null;
  currentPrice?: number | null;
  priceLabel?: string;
  status: "available" | "coming_soon";
  razorpayPlanId?: string | null;
  features: string[];
  limits: {
    teamMembers: number | "unlimited";
    swipeFiles: number | "unlimited";
    sharedAds: number | "unlimited";
  };
};

export const BILLING_CONFIG: Record<string, PlanConfig> = {
  scout: {
    id: "scout",
    name: "Scout",
    audience: "For individual marketers and creative researchers.",
    regularPrice: 2499,
    currentPrice: 499,
    status: "available",
    features: [
      "Discover Ads",
      "Search & Filters",
      "Ad Details",
      "Brand Research",
      "Swipe Files",
      "Shared Ads",
    ],
    limits: {
      teamMembers: 1,
      swipeFiles: 5,
      sharedAds: 10,
    }
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    audience: "For growing marketing and creative teams.",
    regularPrice: null,
    currentPrice: null,
    priceLabel: "Pricing to be announced",
    status: "coming_soon",
    features: ["Built for growing team workflows.", "Plan details coming soon."],
    limits: {
      teamMembers: 5,
      swipeFiles: "unlimited",
      sharedAds: "unlimited",
    }
  },
  agency: {
    id: "agency",
    name: "Agency",
    audience: "For agencies and larger creative research teams.",
    regularPrice: null,
    currentPrice: null,
    priceLabel: "Pricing to be announced",
    status: "coming_soon",
    features: ["Designed for larger agency research workflows.", "Plan details coming soon."],
    limits: {
      teamMembers: 20,
      swipeFiles: "unlimited",
      sharedAds: "unlimited",
    }
  },
} as const;

export type PlanKey = keyof typeof BILLING_CONFIG;

// Legacy mapping layer
export const LEGACY_PLAN_MAP: Record<string, keyof typeof BILLING_CONFIG> = {
  pro: "scout",
  ads_hunting_pro: "scout",
  basic: "scout",
};

export function resolvePlanKey(rawKey?: string | null): PlanKey | null {
  if (!rawKey) return null;
  const mapped = LEGACY_PLAN_MAP[rawKey.toLowerCase()];
  if (mapped) return mapped;
  if (BILLING_CONFIG[rawKey as PlanKey]) return rawKey as PlanKey;
  return null;
}
