"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandMark } from "@/components/brand-mark";

const TESTIMONIALS = [
  {
    quote: "A focused swipe file turns scattered inspiration into decisions your team can trust.",
    author: "AdsHunting Intelligence",
    role: "Editorial Pick"
  },
  {
    quote: "AdsHunting replaced 14 open tabs and messy Slack channels with instant, high-signal ad references.",
    author: "Sarah Chen",
    role: "Head of Growth · BrandLab"
  },
  {
    quote: "We scaled 3 winning hooks this month alone by studying competitor longevity directly on AdsHunting.",
    author: "Marcus Rivera",
    role: "Creative Strategist · DTC Scale"
  },
  {
    quote: "The cleanest ad intelligence software on the market. Our creative review meetings are twice as fast.",
    author: "Elena Rostova",
    role: "Performance Lead · Velocity Media"
  }
];

export function AuthShell({ children, mode }: { children: ReactNode; mode: "sign-in" | "sign-up" }) {
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const title = mode === "sign-in" ? "Welcome to AdsHunting" : "Create your AdsHunting account";
  const body =
    mode === "sign-in"
      ? "Log in to continue tracking competitors, saving creative signals, and building sharper ad research."
      : "Start your creative intelligence workspace and build a cleaner way to research ads.";

  const activeTestimonial = TESTIMONIALS[currentTestimonialIndex];

  return (
    <main className="flex min-h-[100dvh] flex-col overflow-hidden bg-white text-ink lg:flex-row">
      <section className="auth-visual-panel relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-[#247A2B] px-7 py-7 text-white sm:min-h-[400px] sm:px-10 sm:py-10 lg:min-h-[100dvh] lg:w-[58%] lg:px-14 lg:py-14 xl:px-16">
        {/* Ambient Aurora Glows (Replaced Laser Lines) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="auth-aurora-glow auth-aurora-one" />
          <div className="auth-aurora-glow auth-aurora-two" />
          <div className="absolute inset-0 bg-radial from-white/10 via-transparent to-black/20" />
        </div>

        {/* Top Branding & Main Pitch */}
        <div className="relative z-10 max-w-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 motion-safe:duration-700">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A8F763] animate-pulse" />
            Creative Intelligence
          </p>
          <h1 className="text-[32px] font-black leading-[1.08] text-white sm:text-[44px] lg:text-[50px] tracking-tight text-balance">
            Empowering the ad research revolution
          </h1>
        </div>

        {/* Dynamic Rotating Testimonials / Reviews (Rotates every 5s) */}
        <div className="relative z-10 mt-12 max-w-lg">
          <div className="relative min-h-[110px] sm:min-h-[96px] flex flex-col justify-end">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonialIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col"
              >
                <p className="text-[15px] sm:text-[16px] font-medium leading-relaxed text-white/95 text-balance">
                  &ldquo;{activeTestimonial.quote}&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-lime-200">
                    {activeTestimonial.author}
                  </span>
                  <span className="text-[12px] text-white/50">•</span>
                  <span className="text-[12px] font-medium text-white/80">
                    {activeTestimonial.role}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Testimonial Step Dots */}
          <div className="mt-5 flex items-center gap-2">
            {TESTIMONIALS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentTestimonialIndex(idx)}
                aria-label={`Go to review ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentTestimonialIndex
                    ? "w-7 bg-[#A8F763]"
                    : "w-2 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-[#FEFFFD] px-5 py-10 sm:px-8 sm:py-12 lg:min-h-[100dvh] lg:w-[40%] lg:px-10 xl:px-14">
        <div className="w-full max-w-[420px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-700">
          <div className="mb-8 flex justify-center">
            <BrandMark compact href="/" />
          </div>

          <div className="mb-7 text-center">
            <h2 className="text-[28px] font-extrabold leading-tight text-[#0E1228] sm:text-[32px]">{title}</h2>
            <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-[#69718A]">{body}</p>
          </div>

          <div className="w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
