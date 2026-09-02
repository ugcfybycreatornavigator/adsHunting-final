import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { pricingPlans } from "@/data/landing/config";

export const SEO = {
  siteName: BRAND.name,
  domain: "adshunting.com",
  url: "https://adshunting.com",
  title:
    "AdsHunting — Ad Intelligence & Competitor Ad Research Platform",
  description:
    "AdsHunting helps marketers and teams discover, research, save, organize, analyze, and share competitor advertising creatives from one focused ad intelligence workspace.",
  socialImagePath: "/opengraph-image",
  logoPath: "/logo.png",
  locale: "en_US",
} as const;

export type PublicRoute = {
  path: string;
  title: string;
  description: string;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
};

export const publicRoutes: PublicRoute[] = [
  {
    path: "/",
    title: SEO.title,
    description: SEO.description,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/pricing",
    title: "Pricing for Ad Intelligence & Creative Research",
    description:
      "Review AdsHunting pricing for competitor ad research, creative discovery, Swipe Files, sharing, and the Scout launch plan.",
    changeFrequency: "monthly",
    priority: 0.85,
  },
  {
    path: "/product/discover-ads",
    title: "Ad Discovery Platform for Competitor Creative Research",
    description:
      "Use AdsHunting to discover competitor ads, search observable creative data, and begin focused ad research without drowning in browser tabs.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/product/creative-intelligence",
    title: "Creative Intelligence Software for Advertising Teams",
    description:
      "Turn competitor ad examples into clearer creative intelligence with observable ad context, messaging patterns, and structured review workflows.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/product/swipe-files",
    title: "Swipe Files for Saving and Organizing Ad Inspiration",
    description:
      "Save ad inspiration into organized Swipe Files so creative research stays useful for campaigns, competitors, hooks, formats, and offers.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/product/ad-sharing",
    title: "Ad Sharing for Teams, Clients, and Creative Research",
    description:
      "Share competitor ads and creative research context with teammates or clients while keeping research organized inside AdsHunting.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/resources",
    title: "Ad Research Resources, Guides, and Creative Strategy",
    description:
      "Read AdsHunting guides on competitor ad research, Meta ad creative analysis, Swipe Files, and practical creative research workflows.",
    changeFrequency: "weekly",
    priority: 0.75,
  },
  {
    path: "/resources/how-it-works",
    title: "How AdsHunting Works",
    description:
      "Learn how AdsHunting helps you search, review, save, organize, and share advertising creatives from one research workflow.",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/resources/creative-research",
    title: "Creative Ad Research Guide",
    description:
      "A practical guide to researching advertising creatives, identifying patterns, and organizing useful references.",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/resources/competitor-ad-research",
    title: "Competitor Ad Research Guide",
    description:
      "Learn how to research competitor advertising activity using observable creative information without relying on private performance metrics.",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/resources/help",
    title: "AdsHunting Help & FAQ",
    description:
      "Answers about AdsHunting, what the product does, what information is available, and how the core research workflow works.",
    changeFrequency: "monthly",
    priority: 0.55,
  },
  {
    path: "/about",
    title: "About AdsHunting",
    description:
      "Learn about AdsHunting, the ad intelligence workspace built to help teams make creative research more organized and useful.",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: "/contact",
    title: "Contact AdsHunting",
    description:
      "Contact AdsHunting with product, free trial, pricing, billing, team, agency, or ad research workflow questions.",
    changeFrequency: "yearly",
    priority: 0.55,
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Review the AdsHunting privacy policy, including product data, account data, billing, and creative research handling.",
    changeFrequency: "yearly",
    priority: 0.35,
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Review the AdsHunting terms of service for product access, account responsibilities, subscriptions, and acceptable use.",
    changeFrequency: "yearly",
    priority: 0.35,
  },
];

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SEO.url}${normalizedPath}`;
}

export function createMetadata({
  title,
  description,
  path = "/",
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(SEO.socialImagePath);

  return {
    title,
    description,
    alternates: noIndex ? undefined : { canonical: path },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website",
      locale: SEO.locale,
      siteName: SEO.siteName,
      title,
      description,
      url,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SEO.siteName} ad intelligence workspace preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SEO.url}/#organization`,
    name: SEO.siteName,
    url: SEO.url,
    logo: absoluteUrl(SEO.logoPath),
    description: SEO.description,
  };
}

export function softwareApplicationJsonLd() {
  const scoutPlan = pricingPlans.find((plan) => plan.id === "scout");

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SEO.url}/#software-application`,
    name: SEO.siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SEO.url,
    description: SEO.description,
    offers:
      scoutPlan?.price && scoutPlan.currency
        ? {
            "@type": "Offer",
            price: scoutPlan.price,
            priceCurrency: scoutPlan.currency === "₹" ? "INR" : scoutPlan.currency,
            availability: "https://schema.org/InStock",
            url: absoluteUrl("/pricing"),
          }
        : undefined,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
