import React from 'react';
import type { Metadata } from 'next';
import { HeroSection } from '@/components/landing/sections/HeroSection';
import { TrustProofSection } from '@/components/landing/sections/TrustProofSection';
import { CoreValueSection } from '@/components/landing/sections/CoreValueSection';
import { WorkflowSection } from '@/components/landing/sections/WorkflowSection';
import { DiscoverAdsSection } from '@/components/landing/sections/DiscoverAdsSection';

import { CapabilityGridSection } from '@/components/landing/sections/CapabilityGridSection';
import { IntelligenceSharingSection } from '@/components/landing/sections/IntelligenceSharingSection';
import { FAQSection } from '@/components/landing/sections/FAQSection';
import { FinalCTASection } from '@/components/landing/sections/FinalCTASection';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { CTAButton } from '@/components/landing/ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { User, FolderOpen, Share2, Search, Target } from 'lucide-react';
import { createMetadata, jsonLd } from '@/lib/seo';
import { homepageFaqs } from '@/data/landing/faq';

export const metadata: Metadata = createMetadata({
  title: 'AdsHunting — Ad Intelligence & Competitor Ad Research Platform',
  description:
    'AdsHunting helps marketers and teams discover, research, save, organize, analyze, and share competitor advertising creatives from one focused ad intelligence workspace.',
  path: '/',
});

function PricingSection() {
  const scoutFeatures = [
    { text: "1 User", icon: User },
    { text: "Swipe Files", icon: FolderOpen },
    { text: "Shared Ads allowance", icon: Share2 },
    { text: "Brand Search", icon: Search },
    { text: "Active Competitor", icon: Target },
  ];

  return (
    <section
      id="pricing"
      className="py-[72px] md:py-[100px] lg:py-[120px] bg-slate-50/50 border-t border-border relative overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(94,169,32,0.08), transparent 70%)'
        }}
      />

      <LandingContainer className="relative z-10">
        <div className="flex flex-col items-center text-center mb-12 md:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-2 h-2 rounded-full bg-brand"></span>
            <span className="text-[14px] font-bold tracking-widest uppercase text-text-primary">
              SIMPLE PRICING
            </span>
          </div>
          <h2 className="text-[34px] md:text-[44px] lg:text-[48px] leading-[1.05] font-bold tracking-tight text-text-primary text-balance max-w-[700px]">
            Start small. Hunt smarter.
          </h2>
          <p className="text-[16px] md:text-[18px] leading-relaxed text-text-secondary max-w-[650px] text-balance mt-6">
            Get started with AdsHunting at our launch price. Upgrade options for growing teams are coming soon.
          </p>
        </div>

        {/* Desktop: 3-column, Tablet: 1 top + 2 bottom, Mobile: Stacked with Scout first */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px] mx-auto items-start relative">

          {/* Scout Plan - Rendered First in DOM for mobile accessibility */}
          <div className="flex flex-col rounded-[24px] p-7 md:p-9 border-[1.5px] border-brand shadow-[0_18px_50px_rgba(30,58,138,0.06),0_4px_14px_rgba(0,0,0,0.03)] order-first md:order-none lg:order-2 relative z-10 transition-transform duration-300 hover:-translate-y-1 bg-white"
            style={{ background: 'linear-gradient(180deg, rgba(94,169,32,.06), #FFFFFF 28%)' }}>

            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[24px] font-bold text-text-primary">SCOUT</h3>
              <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold tracking-wider text-brand-strong uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-brand mr-2"></span>
                LAUNCH OFFER
              </span>
            </div>

            <div className="mb-8">
              <div className="flex flex-col">
                <span className="text-[16px] font-semibold text-text-muted line-through mb-1">₹2,499</span>
                <div className="flex items-end gap-1.5">
                  <span className="text-[52px] font-extrabold text-text-primary leading-[0.85] tracking-tight">₹499</span>
                  <span className="text-[16px] font-medium text-text-muted mb-1">/ month</span>
                </div>
              </div>
              <p className="text-[15px] text-text-secondary mt-5 min-h-[44px]">
                Everything you need to start researching, saving and sharing winning creative.
              </p>
            </div>

            <div className="flex-grow border-t border-border/80 pt-8">
              <ul className="space-y-4 text-[15px] text-text-primary">
                {scoutFeatures.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <feature.icon size={18} className="text-brand shrink-0" strokeWidth={2.5} />
                    <span className="font-medium text-text-primary">
                      {/* Emphasize the number visually */}
                      {feature.text.replace(/^[0-9]+/, '') !== feature.text ? (
                        <>
                          <strong className="font-bold text-[16px]">{feature.text.match(/^[0-9]+/)?.[0]}</strong>
                          {feature.text.replace(/^[0-9]+/, '')}
                        </>
                      ) : (
                        feature.text
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10">
              <CTAButton href={authLinks.signUp} className="w-full h-[52px] rounded-[14px] text-[16px] shadow-sm hover:shadow-md justify-center">
                Start 7-Day Free Trial
              </CTAButton>
            </div>
          </div>

          {/* Hunter Plan */}
          <div className="flex flex-col bg-white rounded-[24px] p-7 md:p-8 border border-border order-2 md:order-1 lg:order-1 lg:mt-6 transition-all duration-300">
            <h3 className="text-[20px] font-bold text-text-primary mb-5 uppercase tracking-wide">HUNTER</h3>

            <p className="text-[15px] text-text-secondary mb-8">
              More capacity for growing creative research workflows.
            </p>

            <div className="flex-grow border-t border-border pt-8 flex items-center justify-center min-h-[220px]">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-[12px] font-bold tracking-widest text-text-muted border border-border uppercase">
                Coming Soon
              </span>
            </div>
          </div>

          {/* Agency Plan */}
          <div className="flex flex-col bg-white rounded-[24px] p-7 md:p-8 border border-border order-3 md:order-3 lg:order-3 md:col-span-2 lg:col-span-1 lg:mt-6 transition-all duration-300">
            <h3 className="text-[20px] font-bold text-text-primary mb-5 uppercase tracking-wide">AGENCY</h3>

            <p className="text-[15px] text-text-secondary mb-8">
              Built for larger teams and agency workflows.
            </p>

            <div className="flex-grow border-t border-border pt-8 flex items-center justify-center min-h-[220px]">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-[12px] font-bold tracking-widest text-text-muted border border-border uppercase">
                Coming Soon
              </span>
            </div>
          </div>

        </div>

        <div className="mt-16 md:mt-24 text-center">
          <p className="text-[15px] text-text-muted">
            Have questions about AdsHunting or billing? <br className="md:hidden" /> Scroll down for our FAQ.
          </p>
        </div>
      </LandingContainer>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: homepageFaqs.map((faq) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          }),
        }}
      />
      <HeroSection />
      <TrustProofSection />
      <CoreValueSection />
      <WorkflowSection />
      <DiscoverAdsSection />

      <CapabilityGridSection />
      <IntelligenceSharingSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
    </>
  );
}
