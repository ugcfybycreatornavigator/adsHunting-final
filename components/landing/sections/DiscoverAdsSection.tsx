import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';

export function DiscoverAdsSection() {
  return (
    <section id="discover" className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(94,169,32,0.03), transparent 60%)'
        }}
      />
      <LandingContainer className="text-center flex flex-col items-center relative z-10">

        <div className="max-w-[800px] mb-12 md:mb-16">
          <h2 className="text-[36px] md:text-[48px] lg:text-[56px] leading-[1.05] font-bold tracking-tight text-text-primary text-balance mb-6">
            Search the market, not ten different tabs.
          </h2>
          <p className="text-[18px] md:text-[20px] text-text-secondary max-w-[600px] mx-auto leading-relaxed">
            Instantly discover relevant creatives using advanced filters like brand, format, category, and active status.
          </p>
        </div>

        <div className="w-full max-w-[1100px] rounded-2xl overflow-hidden mb-12 border border-border shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <img src="/images/how-it-works/discover.jpg" alt="Discover Ads" className="w-full h-auto" />
        </div>

        <CTAButton href={authLinks.signUp} size="lg" className="h-12 md:h-14 px-8">
          Start discovering ads <span className="ml-2">→</span>
        </CTAButton>
      </LandingContainer>
    </section>
  );
}
