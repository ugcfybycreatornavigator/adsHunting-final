import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { ArrowRight } from 'lucide-react';

export function FinalCTASection() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-[#5EA920] via-[#4D8A1A] to-[#022C22] overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-white/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/3 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-black/20 blur-[100px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/3"></div>

      <LandingContainer className="text-center flex flex-col items-center relative z-10">
        <h2 className="text-[38px] md:text-[48px] lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.05] max-w-[700px] mb-5">
          Stop hunting ads manually.
        </h2>
        <p className="text-[17px] md:text-[20px] font-medium text-white/90 max-w-[500px] mb-10 leading-relaxed">
          Turn competitor creative into your next idea.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
          <CTAButton href={authLinks.signUp} variant="inverted" size="lg" className="w-full sm:w-auto h-14 md:h-16 px-10 text-[18px] font-bold shadow-lg shadow-black/10 group">
            Start 7-Day Free Trial <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </CTAButton>
        </div>
        <div className="mt-8">
          <span className="text-white/80">Already have an account?</span>{' '}
          <a href={authLinks.signIn} className="text-white font-bold hover:underline">
            Sign In
          </a>
        </div>
      </LandingContainer>
    </section>
  );
}
