import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { CreativeIntelligenceAnimation } from '../animations/CreativeIntelligenceAnimation';

export function CoreValueSection() {
  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(94,169,32,0.03), transparent 60%)'
        }}
      />
      <LandingContainer className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-12 lg:gap-8 items-center max-w-[1200px] mx-auto">
          {/* 40% Text Side */}
          <div className="max-w-[600px]">
            <h2 className="text-[36px] sm:text-[44px] md:text-[54px] leading-[1.05] font-bold tracking-tight text-text-primary text-balance">
              Stop collecting screenshots. <br className="hidden md:block" />
              <span className="text-brand">Start building creative intelligence.</span>
            </h2>
            <p className="mt-6 text-[18px] md:text-[20px] leading-relaxed text-text-secondary">
              A messy folder of inspiration isn&apos;t enough. AdsHunting organizes the market&apos;s best ads so you always know what works.
            </p>
          </div>

          {/* 60% Visual Side */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-[600px] rounded-[20px] border border-black/[0.08] shadow-sm bg-[#FAFAFA] overflow-hidden flex items-center justify-center">
            <CreativeIntelligenceAnimation />
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
