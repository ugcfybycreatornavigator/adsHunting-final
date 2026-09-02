import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle, Lightbulb, TrendingUp } from "lucide-react";
import { LandingContainer } from "@/components/landing/layout/LandingContainer";
import { createMetadata, breadcrumbJsonLd, jsonLd } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Ad Research Resources, Guides, and Creative Strategy",
  description:
    "Read AdsHunting guides on competitor ad research, Meta ad creative analysis, Swipe Files, and practical creative research workflows.",
  path: "/resources",
});

const resources = [
  {
    title: "How AdsHunting Works",
    description: "Learn the Search, Review, Save, Organize, and Share workflow.",
    href: "/resources/how-it-works",
    icon: BookOpen,
  },
  {
    title: "Creative Research Guide",
    description: "Structure creative ad research around observable patterns and useful references.",
    href: "/resources/creative-research",
    icon: Lightbulb,
  },
  {
    title: "Competitor Ad Research",
    description: "Research competitor advertising activity without guessing private performance metrics.",
    href: "/resources/competitor-ad-research",
    icon: TrendingUp,
  },
  {
    title: "Help & FAQ",
    description: "Answers about AdsHunting features, data limits, sharing, saving, and billing.",
    href: "/resources/help",
    icon: HelpCircle,
  },
];

export default function ResourcesPage() {
  return (
    <div className="bg-[#fcfcfa]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Resources", path: "/resources" },
            ]),
          ),
        }}
      />
      <LandingContainer>
        <section className="py-16 md:py-24">
          <div className="max-w-[820px]">
            <span className="text-brand font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 block">
              RESOURCES
            </span>
            <h1 className="text-[38px] md:text-[58px] lg:text-[68px] leading-[1.02] font-extrabold tracking-tight text-text-primary text-balance">
              Practical guides for ad intelligence and creative research.
            </h1>
            <p className="mt-7 text-[18px] md:text-[20px] leading-relaxed text-text-secondary max-w-[700px]">
              Learn how to research competitor ads, analyze observable creative patterns, build useful Swipe Files, and turn advertising inspiration into clearer creative decisions.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {resources.map((resource) => {
              const Icon = resource.icon;
              return (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="group rounded-[20px] border border-border bg-white p-6 md:p-7 transition-colors hover:border-[#d2dfcb] hover:bg-surface-blue"
                >
                  <div className="mb-6 grid size-11 place-items-center rounded-xl bg-surface-blue text-brand group-hover:bg-white">
                    <Icon size={21} />
                  </div>
                  <h2 className="text-[21px] font-bold text-text-primary">{resource.title}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{resource.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-brand-strong">
                    Read guide <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </LandingContainer>
    </div>
  );
}
