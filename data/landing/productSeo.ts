import { Bookmark, BrainCircuit, Search, Share2 } from "lucide-react";

export const productSeoPages = [
  {
    slug: "discover-ads",
    navName: "Discover Ads",
    eyebrow: "AD DISCOVERY",
    icon: Search,
    title: "Discover competitor ads without losing the research thread.",
    metaTitle: "Ad Discovery Platform for Competitor Creative Research",
    description:
      "Use AdsHunting to search competitor ads, review observable creative data, and start focused ad research from one organized workspace.",
    intro:
      "Ad discovery is the starting point for every useful competitor research workflow. AdsHunting helps marketers search for relevant advertising creatives by brand, keyword, format, status, and other available context so research starts with useful examples rather than scattered tabs.",
    demoTitle: "Search, filter, and review before you save.",
    demoItems: ["Brand and keyword search", "Format and status filters", "Creative preview grid", "Observable ad context"],
    useCases: [
      "Find active competitor ads for a campaign planning session.",
      "Research Meta ad examples before writing new creative briefs.",
      "Collect ad inspiration across brands, categories, offers, and formats.",
    ],
    benefits: [
      "Reduce manual searching across disconnected sources.",
      "Keep discovery connected to review, saving, and sharing.",
      "Avoid treating private performance metrics as public facts.",
    ],
    workflow: [
      "Search by brand, competitor, or creative idea.",
      "Filter the results using supported observable fields.",
      "Open relevant ads to inspect copy, format, media, status, and destination context.",
      "Save the examples that belong in your research library.",
    ],
    faqs: [
      {
        question: "Is AdsHunting a Meta Ads Library alternative?",
        answer:
          "AdsHunting is built for creative research workflows around observable ad information. It can complement public ad libraries by helping teams organize discovery, review, saving, and sharing in one product workflow.",
      },
      {
        question: "Can I search Facebook and Meta ad examples?",
        answer:
          "AdsHunting supports research workflows around observable advertising creatives from supported sources, including Meta-related ad research where available.",
      },
    ],
    related: [
      { text: "Creative Intelligence", href: "/product/creative-intelligence" },
      { text: "Competitor Ad Research Guide", href: "/resources/competitor-ad-research" },
    ],
  },
  {
    slug: "creative-intelligence",
    navName: "Creative Intelligence",
    eyebrow: "CREATIVE INTELLIGENCE",
    icon: BrainCircuit,
    title: "Turn ad examples into creative intelligence your team can use.",
    metaTitle: "Creative Intelligence Software for Advertising Teams",
    description:
      "Review competitor ad creatives, analyze observable patterns, and turn research into clearer creative direction without inventing private performance data.",
    intro:
      "Creative intelligence is not just collecting ads. It is the practice of reviewing messaging, format, offer, hook, visual structure, and market patterns so teams can make better creative decisions. AdsHunting keeps that review process grounded in observable information.",
    demoTitle: "A clearer review surface for creative decisions.",
    demoItems: ["Creative format", "Primary copy", "Runtime context", "Destination signals"],
    useCases: [
      "Prepare a creative brief with evidence from competitor advertising activity.",
      "Compare how brands structure hooks, offers, CTAs, and product demonstrations.",
      "Separate visible creative patterns from assumptions about ROAS, CTR, CPC, or sales.",
    ],
    benefits: [
      "Move from passive inspiration to structured creative analysis.",
      "Give strategists, media buyers, and designers a shared research language.",
      "Keep claims honest by focusing on information that can actually be observed.",
    ],
    workflow: [
      "Start with a clear research question.",
      "Review multiple relevant creatives side by side.",
      "Look for repeated hooks, formats, claims, offers, and visual structures.",
      "Save and share the references that support the creative direction.",
    ],
    faqs: [
      {
        question: "Does AdsHunting show private ad performance metrics?",
        answer:
          "No. AdsHunting does not claim access to private advertiser metrics such as ROAS, CTR, CPC, sales, revenue, or conversion data.",
      },
      {
        question: "Who uses creative intelligence software?",
        answer:
          "Creative strategists, growth marketers, founders, agencies, and media teams can use creative intelligence workflows to understand market messaging and organize ad inspiration.",
      },
    ],
    related: [
      { text: "Creative Research Guide", href: "/resources/creative-research" },
      { text: "Swipe Files", href: "/product/swipe-files" },
    ],
  },
  {
    slug: "swipe-files",
    navName: "Swipe Files",
    eyebrow: "SWIPE FILES",
    icon: Bookmark,
    title: "Save ad inspiration into Swipe Files that stay useful.",
    metaTitle: "Swipe Files for Saving and Organizing Ad Inspiration",
    description:
      "Use AdsHunting Swipe Files to save competitor ads, organize creative inspiration, and revisit research by campaign, competitor, hook, format, or offer.",
    intro:
      "A folder of screenshots is easy to create and hard to use. AdsHunting Swipe Files help teams save advertising creatives with context, organize examples around real research themes, and revisit useful references when creative decisions need to be made.",
    demoTitle: "Organized inspiration beats scattered screenshots.",
    demoItems: ["Campaign folders", "Competitor collections", "Hook and offer themes", "Reusable creative references"],
    useCases: [
      "Build a competitor Swipe File before a new launch.",
      "Save Meta ad inspiration by format, hook, or offer.",
      "Collect references for designers, copywriters, media buyers, and clients.",
    ],
    benefits: [
      "Keep creative references tied to the original research context.",
      "Organize examples around how your team actually works.",
      "Make ad inspiration searchable and shareable instead of temporary.",
    ],
    workflow: [
      "Find relevant ads through discovery.",
      "Review the creative and decide why it matters.",
      "Save it into a named Swipe File.",
      "Use the collection to brief, compare, and share creative ideas.",
    ],
    faqs: [
      {
        question: "What is a Swipe File?",
        answer:
          "A Swipe File is an organized collection of useful creative references. In AdsHunting, Swipe Files help teams save and revisit ad examples with research context.",
      },
      {
        question: "Can Swipe Files be organized by competitor or campaign?",
        answer:
          "Yes. Teams can organize saved ad references around competitors, campaigns, hooks, formats, offers, or any research structure that supports their workflow.",
      },
    ],
    related: [
      { text: "Ad Sharing", href: "/product/ad-sharing" },
      { text: "How AdsHunting Works", href: "/resources/how-it-works" },
    ],
  },
  {
    slug: "ad-sharing",
    navName: "Ad Sharing",
    eyebrow: "AD SHARING",
    icon: Share2,
    title: "Share competitor ad research without stripping away context.",
    metaTitle: "Ad Sharing for Teams, Clients, and Creative Research",
    description:
      "Create shareable AdsHunting links so teammates, clients, and stakeholders can review ad creatives with the context behind your research.",
    intro:
      "Creative research becomes more valuable when it can move through the team cleanly. AdsHunting sharing helps users send relevant ad examples and research context to teammates, clients, or stakeholders without relying on disconnected screenshots.",
    demoTitle: "Research links built for review, not clutter.",
    demoItems: ["Public share links", "Private share links", "Creative context", "Link management"],
    useCases: [
      "Send a competitor creative example to a teammate.",
      "Share a research collection with a client before a strategy call.",
      "Keep creative feedback connected to the ad that prompted it.",
    ],
    benefits: [
      "Make creative research easier to review asynchronously.",
      "Keep the ad, context, and notes closer together.",
      "Control whether shared research should be public or auth-gated.",
    ],
    workflow: [
      "Save or select the ad creative worth sharing.",
      "Create a share link with the right visibility.",
      "Send it to the teammate, client, or stakeholder.",
      "Revoke or manage links when access should change.",
    ],
    faqs: [
      {
        question: "Are shared ad pages indexed by search engines?",
        answer:
          "No. AdsHunting shared-ad URLs are excluded from the sitemap and marked non-indexable by default to avoid thin user-generated pages appearing in search results.",
      },
      {
        question: "Can shared links be private?",
        answer:
          "Yes. AdsHunting supports private share links for cases where research should require sign-in before viewing.",
      },
    ],
    related: [
      { text: "Swipe Files", href: "/product/swipe-files" },
      { text: "Help & FAQ", href: "/resources/help" },
    ],
  },
] as const;

export type ProductSeoPage = (typeof productSeoPages)[number];

export function getProductSeoPage(slug: string) {
  return productSeoPages.find((page) => page.slug === slug);
}
