import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, ChevronRight } from "lucide-react";
import { CTAButton } from "@/components/landing/ui/CTAButton";
import { LandingContainer } from "@/components/landing/layout/LandingContainer";
import { authLinks } from "@/data/landing/config";
import { getProductSeoPage, productSeoPages } from "@/data/landing/productSeo";
import {
  breadcrumbJsonLd,
  createMetadata,
  jsonLd,
} from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return productSeoPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getProductSeoPage(slug);
  if (!page) return {};

  return createMetadata({
    title: page.metaTitle,
    description: page.description,
    path: `/product/${page.slug}`,
  });
}

export default async function ProductSeoPage({ params }: Props) {
  const { slug } = await params;
  const page = getProductSeoPage(slug);
  if (!page) notFound();

  const Icon = page.icon;
  const breadcrumb = [
    { name: "Home", path: "/" },
    { name: "Product", path: "/product/discover-ads" },
    { name: page.navName, path: `/product/${page.slug}` },
  ];

  return (
    <div className="bg-[#fcfcfa]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbJsonLd(breadcrumb)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />

      <LandingContainer>
        <div className="pt-[48px] md:pt-[70px] pb-14 md:pb-20">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              {breadcrumb.map((item, index) => {
                const isCurrent = index === breadcrumb.length - 1;
                return (
                  <li key={item.path} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
                    {isCurrent ? (
                      <span className="font-medium text-text-primary" aria-current="page">
                        {item.name}
                      </span>
                    ) : (
                      <Link href={item.path} className="hover:text-text-primary transition-colors">
                        {item.name}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_460px] gap-12 lg:gap-16 items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d2dfcb] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-widest text-brand-strong">
                <Icon size={15} />
                {page.eyebrow}
              </div>
              <h1 className="max-w-[850px] text-[38px] md:text-[56px] lg:text-[68px] leading-[1.02] font-extrabold tracking-tight text-text-primary text-balance">
                {page.title}
              </h1>
              <p className="mt-7 max-w-[720px] text-[18px] md:text-[20px] leading-relaxed text-text-secondary">
                {page.intro}
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-4">
                <CTAButton href={authLinks.signUp} size="lg" className="h-12 md:h-14 px-8 text-base">
                  Start 7-Day Free Trial
                </CTAButton>
                <CTAButton href="/pricing" variant="outline" size="lg" className="h-12 md:h-14 px-8 text-base">
                  See Pricing
                </CTAButton>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="rounded-[18px] border border-border bg-[#fcfcfa] overflow-hidden">
                <div className="flex h-12 items-center gap-2 border-b border-border bg-white px-4">
                  <span className="size-3 rounded-full bg-red-300" />
                  <span className="size-3 rounded-full bg-yellow-300" />
                  <span className="size-3 rounded-full bg-green-300" />
                  <span className="ml-auto rounded-md bg-surface-subtle px-3 py-1 text-[12px] font-medium text-text-secondary">
                    AdsHunting
                  </span>
                </div>
                <div className="p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-surface-blue text-brand">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-[17px] font-bold text-text-primary">{page.demoTitle}</h2>
                      <p className="text-[13px] text-text-muted">Product workflow preview</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {page.demoItems.map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                        <span className="text-[14px] font-semibold text-text-primary">{item}</span>
                        <CheckCircle2 size={18} className="text-brand" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </LandingContainer>

      <section className="border-y border-border bg-white py-16 md:py-24">
        <LandingContainer>
          <div className="grid gap-10 lg:grid-cols-3">
            <InfoBlock title="Use Cases" items={page.useCases} />
            <InfoBlock title="Benefits" items={page.benefits} />
            <InfoBlock title="Workflow" items={page.workflow} ordered />
          </div>
        </LandingContainer>
      </section>

      <section className="py-16 md:py-24">
        <LandingContainer>
          <div className="grid gap-10 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div>
              <h2 className="text-[30px] md:text-[40px] font-bold leading-tight text-text-primary">
                Questions this page answers.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
                Clear answers for marketers comparing ad intelligence, competitor ad research, Meta ad research, and creative research workflows.
              </p>
            </div>
            <div className="grid gap-4">
              {page.faqs.map((faq) => (
                <article key={faq.question} className="rounded-[18px] border border-border bg-white p-6">
                  <h3 className="text-[18px] font-bold text-text-primary">{faq.question}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </LandingContainer>
      </section>

      <section className="border-t border-border bg-white py-14 md:py-20">
        <LandingContainer>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary">Continue building the workflow.</h2>
              <p className="mt-3 text-text-secondary">Explore related AdsHunting product and resource pages.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {page.related.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center justify-between gap-5 rounded-xl border border-border bg-[#fcfcfa] px-5 py-4 text-[15px] font-semibold text-text-primary transition-colors hover:border-[#d2dfcb] hover:bg-surface-blue"
                >
                  {item.text}
                  <ArrowRight size={17} className="text-brand" />
                </Link>
              ))}
            </div>
          </div>
        </LandingContainer>
      </section>
    </div>
  );
}

function InfoBlock({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: readonly string[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";

  return (
    <section>
      <h2 className="text-[20px] font-bold text-text-primary">{title}</h2>
      <List className="mt-5 space-y-4">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-text-secondary">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-blue text-[12px] font-bold text-brand-strong">
              {ordered ? index + 1 : <Check size={14} aria-hidden="true" />}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </List>
    </section>
  );
}
