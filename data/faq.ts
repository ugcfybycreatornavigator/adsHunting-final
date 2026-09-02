export type FAQItem = {
  id: string;
  question: string;
  answer: string | React.ReactNode;
  keywords?: string[];
};

export type FAQCategory = {
  id: string;
  label: string;
  description?: string;
  items: FAQItem[];
};

export const faqData: FAQCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    items: [
      {
        id: "what-is-adshunting",
        question: "What is AdsHunting?",
        answer: "AdsHunting is a live ads-intelligence platform that helps you discover, save, and analyze winning ad creatives from multiple networks including Meta. It helps marketers and media buyers uncover what's working in their industry.",
      },
      {
        id: "difference-discover-research",
        question: "What is the difference between Discover and Research?",
        answer: "Discover is for finding new creatives across all available advertisers based on filters, keywords, and performance signals. Research (Competitors & Brands) is for analyzing a specific brand's ad strategy, historical creatives, and intelligence profile.",
      },
      {
        id: "how-to-save-ad",
        question: "How do I save an ad?",
        answer: "Click the 'Save' button on any ad card. You can save it directly to your default swipe file, or select/create a specific folder to organize your inspiration.",
      },
    ]
  },
  {
    id: "discover-ads",
    label: "Discover Ads",
    items: [
      {
        id: "how-search-works",
        question: "How does ad search work?",
        answer: "Our search engine queries live ad libraries and our proprietary index simultaneously. You can search by keywords in the ad copy, advertiser name, or specific URLs, and apply filters like platform, media type, and status.",
      },
      {
        id: "why-fewer-results",
        question: "Why might some searches show fewer results?",
        answer: "Results depend on the current live data from ad networks. If an advertiser pauses campaigns, or if a very specific combination of filters is used, fewer ads may match. AdsHunting prioritizes accurate, currently running ads over outdated historical data.",
      },
      {
        id: "what-does-active-mean",
        question: "What does Active mean?",
        answer: "An 'Active' status indicates that the ad was seen running on the publisher network at the time of our last check. Because networks update continuously, an active ad is generally currently spending money.",
      }
    ]
  },
  {
    id: "winning-score",
    label: "Winning Score",
    items: [
      {
        id: "what-is-winning-score",
        question: "What is Winning Score?",
        answer: "Winning Score is a directional intelligence score based on observable ad signals, such as longevity, creative fatigue, and platform distribution. It helps identify ads that advertisers are consistently investing in.",
      },
      {
        id: "does-score-mean-profitable",
        question: "Does Winning Score mean an ad is profitable?",
        answer: "No. AdsHunting does not have access to private financial metrics like ROAS, CTR, CPC, or sales data. A high Winning Score indicates strong observable signals (like long run times) which often correlate with success, but it is not a guarantee of profitability.",
      }
    ]
  },
  {
    id: "data-accuracy",
    label: "Data & Accuracy",
    items: [
      {
        id: "where-does-data-come-from",
        question: "Where does AdsHunting's data come from?",
        answer: "Our data is aggregated from public ad libraries (such as the Meta Ad Library), partner APIs, and our own web intelligence index. We harmonize this data to provide a unified search experience.",
      },
      {
        id: "why-can-ad-disappear",
        question: "Why can an ad disappear?",
        answer: "If an advertiser stops running an ad, it may be removed from upstream libraries. While we archive saved ads, real-time discovery queries will only show what is currently available from the source.",
      },
      {
        id: "are-metrics-available",
        question: "Are CTR/CPC/ROAS available?",
        answer: "No. These are private metrics held by the advertiser and the ad network. Any tool claiming to show exact ROAS or CTR for competitors is estimating. We focus on factual, observable signals instead of fabricated metrics.",
      }
    ]
  },
  {
    id: "billing",
    label: "Billing & Plans",
    items: [
      {
        id: "manage-subscription",
        question: "Where do I manage my subscription?",
        answer: "You can upgrade, change, or cancel your plan by visiting Settings → Payments & Billing. Your current limits and usage are also displayed there.",
      },
      {
        id: "payment-fails",
        question: "What happens if payment fails?",
        answer: "If a payment fails, we will notify you and retry over the next few days. During this grace period, you will retain access to your saved ads, but discovering new ads may be restricted until the billing issue is resolved.",
      }
    ]
  }
];
