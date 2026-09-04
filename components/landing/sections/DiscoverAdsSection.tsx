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

        <div className="w-full max-w-[1100px] mx-auto mb-12 md:mb-16 px-4 flex flex-col items-center">
          {/* Eyebrow Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span className="text-brand font-bold text-[11px] sm:text-xs tracking-[0.16em] uppercase">
              Cross-Platform Ad Discovery
            </span>
          </div>

          {/* Headline strictly in one line on desktop */}
          <h2 className="text-[28px] sm:text-[38px] md:text-[46px] lg:text-[50px] xl:text-[54px] font-extrabold tracking-[-0.03em] text-[#0A0A0A] leading-tight lg:whitespace-nowrap mb-5">
            Search the Market, not <span className="text-brand">ten different tabs</span>.
          </h2>

          {/* Subtitle Balanced to Headline */}
          <p className="text-[17px] sm:text-[19px] md:text-[21px] text-[#525852] font-normal leading-[1.6] max-w-[760px] text-balance">
            Instantly discover relevant creatives using advanced filters like brand, format, category, and active status.
          </p>
        </div>

        {/* Full Width Visual Mockup */}
        <div className="w-full max-w-[1240px] rounded-2xl overflow-hidden mb-12 border border-border shadow-[0_20px_60px_rgba(0,0,0,0.06)] bg-slate-50">
          <img src="/images/how-it-works/discover-updated.png" alt="Discover Ads" className="w-full h-auto" />
        </div>

        <CTAButton href={authLinks.signUp} size="lg" className="h-12 md:h-14 px-8">
          Start discovering ads <span className="ml-2">→</span>
        </CTAButton>
      </LandingContainer>
    </section>
  );
}
