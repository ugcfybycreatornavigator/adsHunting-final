import type { Metadata } from "next";
import { CheckCircle2, Clock, Compass } from "lucide-react";
import { LandingContainer } from "@/components/landing/layout/LandingContainer";
import { CTAButton } from "@/components/landing/ui/CTAButton";
import { authLinks, pricingPlans } from "@/data/landing/config";
import { createMetadata, softwareApplicationJsonLd, jsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Pricing for Ad Intelligence & Creative Research",
  description:
    "Review AdsHunting pricing for competitor ad research, creative discovery, Swipe Files, sharing, and the Scout launch plan.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div className="bg-[#fcfcfa]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(softwareApplicationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Pricing", path: "/pricing" },
            ]),
          ),
        }}
      />

      <LandingContainer>
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-[780px] text-center">
            <span className="text-brand font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 block">
              PRICING
            </span>
            <h1 className="text-[38px] md:text-[58px] lg:text-[68px] leading-[1.02] font-extrabold tracking-tight text-text-primary text-balance">
              Start with the AdsHunting Scout plan.
            </h1>
            <p className="mt-7 text-[18px] md:text-[20px] leading-relaxed text-text-secondary">
              Use AdsHunting for competitor ad research, creative discovery, Swipe Files, and sharing. More capacity for teams and agencies is planned.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => {
              const Icon = plan.icon || Compass;
              const isAvailable = plan.available && plan.price !== null;
              return (
                <article
                  key={plan.id}
                  className={`rounded-[22px] border bg-white p-7 shadow-[0_18px_50px_rgba(45,80,20,0.04)] ${
                    isAvailable ? "border-brand" : "border-border"
                  }`}
                >
                  <div className="mb-7 flex items-center justify-between gap-4">
                    <div className="grid size-11 place-items-center rounded-xl bg-surface-blue text-brand">
                      <Icon size={21} />
                    </div>
                    <span className="rounded-full bg-surface-subtle px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      {plan.badge}
                    </span>
                  </div>
                  <h2 className="text-[24px] font-bold uppercase tracking-wide text-text-primary">{plan.name}</h2>
                  <p className="mt-3 min-h-[48px] text-[15px] leading-relaxed text-text-secondary">{plan.audience}</p>
                  <div className="mt-7 border-t border-border pt-7">
                    {isAvailable ? (
                      <div>
                        <div className="flex items-end gap-1.5">
                          <span className="text-[50px] font-extrabold leading-none text-text-primary">
                            {plan.currency}
                            {plan.price}
                          </span>
                          <span className="mb-1 text-[15px] font-medium text-text-muted">/ {plan.period}</span>
                        </div>
                        <p className="mt-3 text-[14px] text-text-secondary">{plan.trialDays}-day free trial included.</p>
                      </div>
                    ) : (
                      <div className="flex min-h-[83px] items-center gap-3 text-text-secondary">
                        <Clock size={18} />
                        <span className="text-[15px] font-semibold">{plan.pricingLabel}</span>
                      </div>
                    )}
                  </div>
                  {plan.features && (
                    <ul className="mt-7 space-y-3 border-t border-border pt-7">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-[15px] font-medium text-text-primary">
                          <CheckCircle2 size={17} className="text-brand" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-8">
                    {isAvailable ? (
                      <CTAButton href={authLinks.signUp} className="h-12 w-full justify-center rounded-[14px] text-[16px]">
                        Start 7-Day Free Trial
                      </CTAButton>
                    ) : (
                      <div className="flex h-12 w-full items-center justify-center rounded-[14px] border border-border bg-surface-subtle text-[14px] font-bold uppercase tracking-widest text-text-muted">
                        Coming Soon
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </LandingContainer>
    </div>
  );
}
