import { Search, FolderOpen, Share2, BookOpen, Lightbulb, TrendingUp, HelpCircle, Compass, Users, Building2, LucideIcon } from 'lucide-react';


export const authLinks = {
  signIn: '/sign-in',
  signUp: '/sign-up',
};

export const billingConfig = {
  trialDays: 7,
  monthlyPrice: '₹499', // As per example
};

export type PricingFeature = {
  label: string;
  included: boolean;
  value?: string;
};

export type PricingPlan = {
  id: string;
  name: string;
  badge: string;
  audience: string;
  price: number | null;
  currency?: string;
  period?: string;
  pricingLabel?: string;
  trialDays?: number;
  available: boolean;
  features?: string[];
  icon: LucideIcon;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "scout",
    name: "Scout",
    badge: "AVAILABLE NOW",
    audience: "For individual marketers and creative researchers.",
    price: 499,
    currency: "₹",
    period: "month",
    trialDays: 7,
    available: true,
    icon: Compass,
    features: [
      "Discover Ads",
      "Search & Filters",
      "Review Ad Details",
      "Brand Research",
      "Swipe Files",
      "Shared Ads",
    ],
  },
  {
    id: "hunter",
    name: "Hunter",
    badge: "FOR GROWING TEAMS",
    audience: "For growing marketing and creative teams.",
    price: null,
    pricingLabel: "Pricing to be announced",
    available: false,
    icon: Users,
  },
  {
    id: "agency",
    name: "Agency",
    badge: "FOR AGENCIES",
    audience: "For agencies and larger creative research teams.",
    price: null,
    pricingLabel: "Pricing to be announced",
    available: false,
    icon: Building2,
  },
];

export const navigationConfig = {
  product: [
    { 
      name: 'Discover Ads', 
      href: '/product/discover-ads', 
      description: 'Search and research advertising creatives',
      icon: Search 
    },
    {
      name: 'Creative Intelligence',
      href: '/product/creative-intelligence',
      description: 'Review observable patterns in competitor ads',
      icon: Lightbulb
    },
    { 
      name: 'Swipe Files', 
      href: '/product/swipe-files', 
      description: 'Save and organize useful ad inspiration',
      icon: FolderOpen 
    },
    { 
      name: 'Ad Sharing', 
      href: '/product/ad-sharing', 
      description: 'Manage and share ads with your team',
      icon: Share2 
    },
  ],
  resources: [
    {
      name: 'How AdsHunting Works',
      href: '/resources/how-it-works',
      description: 'Learn the Search → Review → Save → Share workflow',
      icon: BookOpen
    },
    {
      name: 'Creative Research Guide',
      href: '/resources/creative-research',
      description: 'Learn how to structure better creative research',
      icon: Lightbulb
    },
    {
      name: 'Competitor Ad Research',
      href: '/resources/competitor-ad-research',
      description: 'Understand how to research competitor advertising activity',
      icon: TrendingUp
    },
    {
      name: 'Help & FAQ',
      href: '/resources/help',
      description: 'Common questions about AdsHunting',
      icon: HelpCircle
    }
  ],
  main: [
    { name: 'Pricing', href: '/pricing' },
    { name: 'FAQ', href: '/resources/help' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
  ]
};
