'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { ArrowRight } from 'lucide-react';

export function AboutContent() {
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="overflow-hidden bg-[#FAFBFA] relative">

      {/* Subtle background typography moment (decorative) */}
      <div className="hidden md:block absolute left-[-5%] top-[60%] select-none pointer-events-none opacity-[0.02] mix-blend-multiply z-0">
        <span className="text-[240px] font-bold tracking-tighter leading-none whitespace-nowrap">
          AdsHunting
        </span>
      </div>

      {/* PART 1 — Intro / Brand Belief */}
      <section className="pt-32 pb-24 md:pt-[160px] md:pb-[140px] relative z-10">
        <LandingContainer>
          <motion.div
            className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-end justify-between w-full"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {/* Left side: Label + Headline */}
            <div className="w-full lg:w-[60%] flex flex-col items-start text-left">
              <motion.div variants={fadeUp} className="flex items-center gap-3 mb-8 md:mb-12">
                <span className="w-2 h-2 rounded-full bg-brand"></span>
                <span className="text-[13px] font-bold tracking-[0.15em] uppercase text-text-primary">
                  ABOUT ADSHUNTING
                </span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-[48px] md:text-[64px] lg:text-[76px] xl:text-[84px] leading-[1.02] font-bold tracking-tight text-text-primary text-balance">
                Creative research shouldn&apos;t feel like detective work.
              </motion.h1>
            </div>

            {/* Right side: Paragraph */}
            <div className="w-full lg:w-[35%] flex flex-col justify-end pb-2 md:pb-4">
              <motion.p variants={fadeUp} className="text-[19px] md:text-[22px] leading-[1.6] text-text-secondary">
                AdsHunting was created to make competitive creative research faster, clearer and more useful — turning scattered advertising data into intelligence teams can actually act on.
              </motion.p>
            </div>
          </motion.div>
        </LandingContainer>
      </section>

      {/* PART 2 — WHY WE STARTED */}
      <section className="py-20 md:py-[140px] border-t border-border/60 relative z-10 bg-white">
        <LandingContainer>
          <div className="w-full max-w-[900px] mx-auto flex flex-col gap-8 md:gap-12">
            
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-[13px] font-bold tracking-widest uppercase text-brand">
                01 — WHY WE STARTED
              </span>
            </motion.div>

            {/* Story */}
            <div className="w-full flex flex-col gap-12">
              <motion.div
                className="flex flex-col gap-5"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                <motion.h2 variants={fadeUp} className="text-[38px] md:text-[50px] font-bold tracking-tight text-text-primary leading-[1.1]">
                  Finding ads was never the real problem.
                </motion.h2>
                <motion.h2 variants={fadeUp} className="text-[28px] md:text-[34px] font-medium tracking-tight text-text-muted leading-[1.2]">
                  Finding the useful signal inside all that noise was.
                </motion.h2>
              </motion.div>

              <motion.div
                className="flex flex-col gap-6 text-[17px] md:text-[19px] leading-relaxed text-text-secondary max-w-[640px]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <p>
                  Creative research is fragmented between ad libraries, browser tabs, screenshots, spreadsheets and disconnected tools. Teams spend too much time collecting information and too little time understanding what competitors are actually testing, scaling and repeating.
                </p>
                <p>
                  AdsHunting was started to make that process organized and dependable.
                </p>
              </motion.div>

              {/* Text-based workflow transformation strip */}
              <motion.div
                className="pt-10 max-w-[640px]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-4 p-8 border border-border/80 rounded-[20px] bg-[#FCFDFB]">
                  <div className="flex flex-col gap-2 relative">
                    <span className="text-[11px] font-mono text-text-muted">01</span>
                    <span className="text-[14px] font-bold tracking-widest text-text-primary uppercase">Scattered ads</span>
                  </div>
                  <div className="hidden sm:block w-8 h-[1px] bg-border/80"></div>
                  <div className="sm:hidden w-[1px] h-6 bg-border/80 ml-2"></div>

                  <div className="flex flex-col gap-2 relative">
                    <span className="text-[11px] font-mono text-text-muted">02</span>
                    <span className="text-[14px] font-bold tracking-widest text-text-primary uppercase">Organized research</span>
                  </div>
                  <div className="hidden sm:block w-8 h-[1px] bg-border/80"></div>
                  <div className="sm:hidden w-[1px] h-6 bg-border/80 ml-2"></div>

                  <div className="flex flex-col gap-2 relative">
                    <span className="text-[11px] font-mono text-brand font-semibold">03</span>
                    <span className="text-[14px] font-bold tracking-widest text-brand uppercase flex items-center gap-2">
                      Useful intelligence
                    </span>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </LandingContainer>
      </section>

      {/* PART 3 — OUR VISION & PART 4 — THREE PRINCIPLES */}
      <section className="py-20 md:py-[140px] border-t border-border/60 relative z-10 bg-[#FAFBFA]">
        <LandingContainer>
          <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-8 md:gap-12">
            
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-[13px] font-bold tracking-widest uppercase text-brand">
                02 — OUR VISION
              </span>
            </motion.div>

            {/* Vision & Principles */}
            <div className="w-full flex flex-col gap-20">

              {/* Vision Statement */}
              <motion.div
                className="flex flex-col gap-10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
              >
                <div className="bg-[#f0f7ec]/50 border border-brand/10 p-10 md:p-14 rounded-[24px] md:rounded-[32px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand/20 to-transparent"></div>
                  <h3 className="text-[34px] md:text-[44px] lg:text-[52px] font-bold text-text-primary leading-[1.1] tracking-tight">
                    A workspace where competitive intelligence feels effortless, dependable and clear.
                  </h3>
                </div>
                <p className="text-[18px] md:text-[20px] leading-relaxed text-text-secondary max-w-[640px]">
                  We believe technology should remove the repetitive work around creative research so teams can spend more time understanding what matters.
                </p>
              </motion.div>

              {/* Three Principles */}
              <motion.div
                className="flex flex-col md:flex-row gap-10 md:gap-0 border-t md:border-t-0 border-border/60 pt-10 md:pt-0"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                {/* Principle 1 */}
                <motion.div variants={fadeUp} className="flex-1 flex flex-col gap-4 md:pr-10 md:border-r border-border/60">
                  <span className="text-[13px] font-mono text-brand font-semibold mb-2">01</span>
                  <h4 className="text-[20px] font-bold text-text-primary">Reliability</h4>
                  <p className="text-[16px] text-text-secondary leading-relaxed">
                    Know what you&apos;re looking at and where it came from.
                  </p>
                </motion.div>

                {/* Principle 2 */}
                <motion.div variants={fadeUp} className="flex-1 flex flex-col gap-4 md:px-10 md:border-r border-border/60">
                  <span className="text-[13px] font-mono text-brand font-semibold mb-2">02</span>
                  <h4 className="text-[20px] font-bold text-text-primary">Simplicity</h4>
                  <p className="text-[16px] text-text-secondary leading-relaxed">
                    Research should remove work, not create more of it.
                  </p>
                </motion.div>

                {/* Principle 3 */}
                <motion.div variants={fadeUp} className="flex-1 flex flex-col gap-4 md:pl-10">
                  <span className="text-[13px] font-mono text-brand font-semibold mb-2">03</span>
                  <h4 className="text-[20px] font-bold text-text-primary">Human judgment</h4>
                  <p className="text-[16px] text-text-secondary leading-relaxed">
                    Technology should surface the signal — people decide what matters.
                  </p>
                </motion.div>
              </motion.div>

            </div>
          </div>
        </LandingContainer>
      </section>

      {/* 06 Final CTA */}
      <section className="bg-[#F6F9F5] py-20 md:py-32 relative z-10 px-4 md:px-8 lg:px-12">
        <div
          className="w-full max-w-[1440px] mx-auto bg-white border border-border/60 rounded-[32px] md:rounded-[40px] p-10 md:p-20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden"
        >
          {/* Background Image with Overlay */}
          <div
            className="absolute inset-0 z-0 opacity-100"
            style={{
              backgroundImage: 'url(/cta-bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent" />

          <div className="flex-1 text-center md:text-left max-w-[600px] relative z-10">
            <h2 className="text-[32px] md:text-[42px] lg:text-[48px] leading-[1.1] font-bold text-text-primary mb-5 tracking-tight">
              See what deserves your attention.
            </h2>
            <p className="text-[17px] md:text-[19px] text-text-secondary leading-relaxed">
              Search creative, understand the context, and start building better research with AdsHunting.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5 w-full md:w-auto shrink-0 relative z-10 md:pr-4">
            <CTAButton href={authLinks.signUp} size="lg" className="w-full md:w-auto h-[60px] px-10 shadow-md text-[17px] font-semibold rounded-full hover:-translate-y-0.5 transition-transform duration-300">
              Get Early Access <ArrowRight size={18} className="ml-2" />
            </CTAButton>
            <a href={authLinks.signIn} className="text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors text-center">
              Already using AdsHunting? Sign In
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
