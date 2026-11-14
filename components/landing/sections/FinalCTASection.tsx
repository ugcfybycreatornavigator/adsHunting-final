import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { authLinks } from '@/data/landing/config';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function FinalCTASection() {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-[#77CD33] via-[#5EA920] to-[#3B7310] overflow-hidden relative isolate">
      {/* Dynamic ambient lighting & mesh glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-radial from-white/25 via-white/5 to-transparent blur-[80px] pointer-events-none"
      />
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#A8F763]/25 blur-[100px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 left-1/4 w-[350px] h-[350px] bg-[#2E5E0C]/35 blur-[80px] rounded-full pointer-events-none translate-y-1/3" />


      <LandingContainer className="text-center flex flex-col items-center relative z-10">

        {/* Headline: Compact, single line on desktop */}
        <h2 className="text-[24px] sm:text-[30px] md:text-[36px] lg:text-[40px] font-extrabold text-white tracking-[-0.03em] leading-[1.15] max-w-[1000px] mb-2.5 text-balance">
          Don’t just shoot ads. Aim for winners.
        </h2>

        {/* Subtitle */}
        <p className="text-[14px] sm:text-[15px] md:text-[16px] font-medium text-white/90 max-w-[540px] mb-7 leading-relaxed text-balance">
          Turn competitor creative into your next profitable campaign.
        </p>

        {/* Premium Animated CTA Button with spacious microcopy */}
        <div className="flex flex-col items-center w-full sm:w-auto">
          <Link
            href={authLinks.signUp}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white px-8 md:px-10 py-3.5 md:py-4 text-[15px] md:text-[16px] font-bold text-[#1E3B0B] shadow-[0_8px_24px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_32px_rgba(0,0,0,0.22)] hover:text-[#142A07] active:scale-[0.98] w-full sm:w-auto"
          >
            {/* Animated shimmer light effect */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />

            {/* Glowing ring animation on hover */}
            <span className="absolute inset-0 rounded-full border border-white/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <span className="relative z-10 flex items-center gap-2">
              Get Early Access
              <ArrowRight
                size={16}
                strokeWidth={2.5}
                className="transition-transform duration-300 group-hover:translate-x-1.5"
              />
            </span>
          </Link>
        </div>

        {/* Sign In link */}
        <div className="mt-6 text-[13px]">
          <span className="text-white/80">Already have an account?</span>{' '}
          <a
            href={authLinks.signIn}
            className="text-white font-bold underline decoration-white/50 underline-offset-4 transition-colors hover:decoration-white hover:text-white"
          >
            Sign In
          </a>
        </div>
      </LandingContainer>
    </section>
  );
}
