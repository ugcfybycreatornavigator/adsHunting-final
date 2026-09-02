'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { HeroOpticalBackground } from './HeroOpticalBackground';
import { HeroProductPreview } from './HeroProductPreview';
import { authLinks } from '@/data/landing/config';
import { ArrowRight, PlayCircle, X } from 'lucide-react';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────
   ENTRANCE ANIMATION VARIANTS
   ───────────────────────────────────────────────────────────────────── */

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30, filter: 'blur(12px)', scale: 0.96 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 1.2,
      delay,
      ease: [0.19, 1, 0.22, 1] as const,
    },
  }),
};

/* ─────────────────────────────────────────────────────────────────────
   HERO SECTION
   ───────────────────────────────────────────────────────────────────── */

export function HeroSection() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // ── Mouse tracking (MotionValues — no React state updates) ──
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const smoothMouseX = useSpring(rawMouseX, { stiffness: 70, damping: 25, mass: 0.5 });
  const smoothMouseY = useSpring(rawMouseY, { stiffness: 70, damping: 25, mass: 0.5 });

  // ── Scroll parallax ──
  const { scrollY } = useScroll();
  const bgTranslateY = useTransform(scrollY, [0, 800], [0, 40]);
  const bgOpacity = useTransform(scrollY, [0, 600], [1, 0.45]);
  const bgScale = useTransform(scrollY, [0, 800], [1, 1.03]);

  // ── Apply mouse position as CSS custom properties (GPU-only) ──
  useEffect(() => {
    // Check for touch device / reduced motion
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReduced) return;

    let frameId: number;
    const updateCSSProps = () => {
      const el = bgRef.current;
      if (el) {
        el.style.setProperty('--hero-mouse-x', String(smoothMouseX.get().toFixed(4)));
        el.style.setProperty('--hero-mouse-y', String(smoothMouseY.get().toFixed(4)));
      }
      frameId = requestAnimationFrame(updateCSSProps);
    };
    frameId = requestAnimationFrame(updateCSSProps);

    return () => cancelAnimationFrame(frameId);
  }, [smoothMouseX, smoothMouseY]);

  // ── Mouse move handler ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // Normalized -1 to 1
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      rawMouseX.set(x);
      rawMouseY.set(y);
    },
    [rawMouseX, rawMouseY],
  );

  const handleMouseLeave = useCallback(() => {
    rawMouseX.set(0);
    rawMouseY.set(0);
  }, [rawMouseX, rawMouseY]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden"
      style={{
        minHeight: '760px',
        background: 'linear-gradient(180deg, #ffffff 0%, #fafcff 100%)',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Animated optical background ── */}
      <motion.div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        style={{
          y: bgTranslateY,
          opacity: bgOpacity,
          scale: bgScale,
        }}
      >
        <HeroOpticalBackground />
      </motion.div>

      {/* ── Hero content ── */}
      <div className="relative z-20 pt-28 pb-20 md:pt-40 md:pb-32">
        <LandingContainer className="flex flex-col items-center text-center">
          <div className="max-w-[1000px] mx-auto">
            {/* Headline */}
            <motion.div
              custom={0.18}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
            >
              <h1
                className="text-balance mx-auto"
                style={{
                  fontSize: 'clamp(38px, 6vw, 84px)',
                  lineHeight: 0.98,
                  fontWeight: 700,
                  letterSpacing: '-0.045em',
                  color: '#0A0A0A',
                  maxWidth: '920px',
                }}
              >
                Find the ads worth{' '}
                <br className="hidden sm:block" />
                <span
                  style={{
                    background: 'linear-gradient(90deg, #4d8a1a, #5ea920, #a3e635)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  stealing inspiration from.
                </span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.div
              custom={0.28}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
            >
              <p
                className="mt-6 md:mt-8 text-balance mx-auto"
                style={{
                  fontSize: 'clamp(16px, 1.4vw, 20px)',
                  lineHeight: 1.6,
                  color: '#52525B',
                  maxWidth: '640px',
                }}
              >
                Search competitor creatives, review the details that matter, save useful inspiration, and share your research from one organized workspace.
              </p>
            </motion.div>

            {/* CTA area */}
            <motion.div
              custom={0.38}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {/* Primary CTA */}
              <Link
                href={authLinks.signUp}
                className="group inline-flex items-center justify-center h-[48px] md:h-[52px] px-7 md:px-8 text-[15px] md:text-[16px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] w-full sm:w-auto"
                style={{
                  borderRadius: '12px',
                  background: '#68B32F',
                  boxShadow: '0 1px 3px rgba(94,169,32,0.18), 0 4px 12px rgba(94,169,32,0.10)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#4F9223';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(94,169,32,0.22), 0 6px 16px rgba(94,169,32,0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#68B32F';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(94,169,32,0.18), 0 4px 12px rgba(94,169,32,0.10)';
                }}
              >
                Start 7-Day Free Trial
                <ArrowRight size={18} strokeWidth={2.5} className="ml-2 transition-transform duration-200 group-hover:translate-x-[3px]" />
              </Link>

              {/* Secondary CTA */}
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="inline-flex items-center justify-center h-[48px] md:h-[52px] px-7 md:px-8 text-[15px] md:text-[16px] font-semibold transition-all duration-200 w-full sm:w-auto"
                style={{
                  borderRadius: '12px',
                  color: '#0A0A0A',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(10,10,10,0.12)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(250,250,250,0.95)';
                  e.currentTarget.style.borderColor = 'rgba(10,10,10,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                  e.currentTarget.style.borderColor = 'rgba(10,10,10,0.12)';
                }}
              >
                <PlayCircle size={18} className="mr-2 text-text-primary" />
                See how it works
              </button>
            </motion.div>
          </div>

          {/* Product preview / search */}
          <motion.div
            custom={0.48}
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            className="w-full mt-16 md:mt-24 relative z-10"
          >
            <HeroProductPreview />
          </motion.div>
        </LandingContainer>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400, mass: 0.8 }}
              className="relative w-full max-w-5xl aspect-video bg-black rounded-[24px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5),0_0_40px_rgba(94,169,32,0.15)] ring-1 ring-white/10 z-10"
            >
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute top-6 right-6 z-20 p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white/90 hover:text-white transition-all duration-200 border border-white/10 hover:scale-105"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
              <video
                src="/videos/demo.mp4"
                controls
                autoPlay
                className="w-full h-full object-cover rounded-[24px]"
              >
                Your browser does not support the video tag.
              </video>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
