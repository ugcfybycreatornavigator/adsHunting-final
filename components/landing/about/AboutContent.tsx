'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { Search, Image as ImageIcon, ArrowRight, Activity, Lock, Globe2 } from 'lucide-react';

export function AboutContent() {
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="overflow-hidden">
      
      {/* 01 About Hero */}
      <section className="bg-white pt-24 pb-20 md:pt-32 md:pb-32 relative border-b border-border">
        <LandingContainer>
          <div className="flex flex-col lg:flex-row items-center gap-16 md:gap-24">
            
            <motion.div 
              className="w-full lg:w-[46%] max-w-[650px] mx-auto lg:mx-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              <motion.div variants={fadeUp} className="flex items-center gap-3 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-text-primary">
                  ABOUT ADSHUNTING
                </span>
              </motion.div>
              <motion.h1 variants={fadeUp} className="text-[48px] md:text-[64px] lg:text-[76px] leading-[0.95] font-bold tracking-tight text-text-primary mb-8">
                Creative research<br/> shouldn&apos;t feel like<br/> detective work.
              </motion.h1>
              <motion.p variants={fadeUp} className="text-[17px] md:text-[19px] leading-relaxed text-text-secondary">
                AdsHunting is built to help teams find useful advertising faster, understand what competitors are doing, and turn creative research into something they can actually use.
              </motion.p>
            </motion.div>

            <motion.div 
              className="w-full lg:w-[54%] max-w-[700px] mx-auto lg:mx-0"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <div className="w-full aspect-[4/3] rounded-[20px] bg-[#FCFDFB] border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 md:p-12 flex flex-col justify-center gap-6 relative overflow-hidden">
                {/* Layer 1: Search */}
                <div className="bg-white border border-border rounded-xl shadow-sm h-12 flex items-center px-4 gap-3 w-[80%] max-w-[300px]">
                   <Search size={16} className="text-text-muted" />
                   <div className="text-[14px] text-text-primary font-medium">Search Puma...</div>
                </div>

                {/* Arrow connector */}
                <div className="flex items-center gap-2 pl-6 opacity-40">
                   <div className="w-[2px] h-6 bg-line" />
                   <ArrowRight size={14} className="text-text-secondary rotate-90 -ml-[8px] mt-8" />
                </div>

                {/* Layer 2: Creative & Winner Score */}
                <div className="flex gap-4 items-start pl-6">
                   <div className="w-32 h-40 bg-surface-subtle border border-line rounded-lg overflow-hidden flex flex-col">
                      <div className="flex-1 bg-brand/5 flex items-center justify-center">
                         <ImageIcon size={24} className="text-brand/30" />
                      </div>
                      <div className="h-10 bg-white border-t border-line px-3 flex items-center">
                         <div className="w-16 h-2 bg-surface rounded-full" />
                      </div>
                   </div>

                   <div className="w-48 bg-white border border-brand/20 rounded-xl p-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-brand/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
                      <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Winner Score</div>
                      <div className="flex items-end gap-2">
                        <span className="text-[28px] font-bold text-text-primary leading-none">84</span>
                        <span className="text-[13px] font-semibold text-brand mb-1 px-2 py-0.5 bg-brand/10 rounded-md">High</span>
                      </div>
                   </div>
                </div>

                {/* Arrow connector */}
                <div className="flex items-center gap-2 pl-12 opacity-40 -mt-2">
                   <div className="w-[2px] h-6 bg-line" />
                   <ArrowRight size={14} className="text-text-secondary rotate-90 -ml-[8px] mt-8" />
                </div>

                {/* Layer 3: Action */}
                <div className="flex gap-3 pl-12 pt-2">
                   <div className="px-4 py-2 bg-text-primary text-white text-[13px] font-medium rounded-lg shadow-sm">Save to Board</div>
                   <div className="px-4 py-2 bg-white border border-border text-text-primary text-[13px] font-medium rounded-lg shadow-sm">Share Link</div>
                </div>
              </div>
            </motion.div>

          </div>
        </LandingContainer>
      </section>

      {/* 02 The Problem */}
      <section className="bg-[#FCFDFB] py-20 md:py-32 border-b border-border">
        <LandingContainer>
          <div className="max-w-[720px] mb-16 md:mb-24">
            <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight text-text-primary leading-[1.1] mb-2">
              The problem isn&apos;t finding more ads.
            </h2>
            <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight text-text-muted leading-[1.1] mb-8">
              It&apos;s turning what you find into useful intelligence.
            </h2>
            <p className="text-[17px] md:text-[19px] leading-relaxed text-text-secondary max-w-[640px]">
              Creative research often gets fragmented across ad libraries, screenshots, browser tabs, spreadsheets, chats, and folders. The valuable part gets lost somewhere between finding an ad and actually using the insight.
            </p>
          </div>

          <motion.div 
            className="flex flex-col md:flex-row items-center gap-8 md:gap-16 max-w-[900px]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Before */}
            <div className="flex-1 w-full">
              <div className="text-[12px] font-bold tracking-widest text-text-muted mb-6 uppercase">BEFORE</div>
              <div className="flex flex-col gap-4">
                 {['Ad Library', 'Screenshots', 'Tabs', 'Folders', 'Messages'].map((item) => (
                   <div key={item} className="flex items-center gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-line" />
                     <span className="text-[16px] text-text-secondary line-through opacity-70">{item}</span>
                   </div>
                 ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="hidden md:block text-line">
              <ArrowRight size={32} strokeWidth={1} />
            </div>

            {/* After */}
            <div className="flex-1 w-full bg-white border border-border p-8 rounded-[20px] shadow-sm">
              <div className="text-[12px] font-bold tracking-widest text-brand mb-6 flex items-center gap-2 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" /> WITH ADSHUNTING
              </div>
              <div className="flex flex-col gap-5">
                 {['Search', 'Understand', 'Organize', 'Share'].map((item, i) => (
                   <div key={item} className="flex items-center gap-4">
                     <span className="text-[14px] font-mono text-text-muted">0{i+1}</span>
                     <span className="text-[18px] font-semibold text-text-primary">{item}</span>
                   </div>
                 ))}
              </div>
            </div>
          </motion.div>
        </LandingContainer>
      </section>

      {/* 03 The Belief */}
      <section className="bg-white py-20 md:py-32 border-b border-border">
        <LandingContainer>
          <div className="max-w-[800px] mb-20">
            <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
              Creative intelligence should lead to action.
            </h2>
            <p className="text-[17px] md:text-[19px] leading-relaxed text-text-secondary">
              Finding inspiration is only valuable if teams can understand why it matters, preserve the context, and use it in the next creative decision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
             <div className="flex flex-col">
                <div className="w-full h-[1px] bg-line mb-6" />
                <span className="text-[13px] font-mono text-brand mb-4">01</span>
                <h3 className="text-[20px] font-bold text-text-primary mb-3">Find signal, not noise.</h3>
                <p className="text-[16px] text-text-secondary leading-relaxed">Creative research should help people prioritize what deserves attention.</p>
             </div>

             <div className="flex flex-col">
                <div className="w-full h-[1px] bg-line mb-6" />
                <span className="text-[13px] font-mono text-brand mb-4">02</span>
                <h3 className="text-[20px] font-bold text-text-primary mb-3">Keep context attached.</h3>
                <p className="text-[16px] text-text-secondary leading-relaxed">An ad is more useful when the creative, brand, format, and research stay connected.</p>
             </div>

             <div className="flex flex-col">
                <div className="w-full h-[1px] bg-line mb-6" />
                <span className="text-[13px] font-mono text-brand mb-4">03</span>
                <h3 className="text-[20px] font-bold text-text-primary mb-3">Make research shareable.</h3>
                <p className="text-[16px] text-text-secondary leading-relaxed">Insights should move easily between people without disappearing into screenshots and chat threads.</p>
             </div>
          </div>
        </LandingContainer>
      </section>

      {/* 04 The Founders */}
      <section className="bg-[#F6F8F5] py-20 md:py-32 border-b border-border">
        <LandingContainer>
          <div className="max-w-[760px] mb-16 md:mb-20">
            <span className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-6 block">THE FOUNDERS</span>
            <h2 className="text-[32px] md:text-[44px] font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
              Built by people who wanted a cleaner creative-research workflow.
            </h2>
            <p className="text-[17px] leading-relaxed text-text-secondary">
              Built around a simple belief: creative research can be better.
            </p>
          </div>

          <div className="bg-white rounded-[20px] border border-border shadow-sm flex flex-col md:flex-row overflow-hidden max-w-[1000px] mb-10">
             
             {/* Shubham */}
             <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-border flex flex-col">
                <div className="mb-10">
                   <div className="w-16 h-16 bg-[#F6F8F5] border border-border rounded-xl flex items-center justify-center mb-6">
                      <span className="text-xl font-bold tracking-widest text-text-primary">SM</span>
                   </div>
                   <h3 className="text-[26px] md:text-[30px] font-bold text-text-primary mb-1">Shubham Mishra</h3>
                   <span className="text-[14px] text-text-muted">Co-Founder</span>
                </div>
                <div className="mt-auto relative">
                   <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand/20" />
                   <p className="text-[16px] leading-relaxed text-text-secondary pl-5 italic">
                     Focused on shaping AdsHunting around a product principle: research tools should reduce noise and help teams get to useful creative decisions faster.
                   </p>
                </div>
             </div>

             {/* Simran */}
             <div className="flex-1 p-8 md:p-12 flex flex-col">
                <div className="mb-10">
                   <div className="w-16 h-16 bg-[#F6F8F5] border border-border rounded-xl flex items-center justify-center mb-6">
                      <span className="text-xl font-bold tracking-widest text-text-primary">SB</span>
                   </div>
                   <h3 className="text-[26px] md:text-[30px] font-bold text-text-primary mb-1">CA Simran Bhaktiyar</h3>
                   <span className="text-[14px] text-text-muted">Co-Founder</span>
                </div>
                <div className="mt-auto relative">
                   <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-brand/20" />
                   <p className="text-[16px] leading-relaxed text-text-secondary pl-5 italic">
                     Focused on building AdsHunting around a sustainable, structured product experience that can become part of how teams work with advertising intelligence.
                   </p>
                </div>
             </div>

          </div>

          <p className="text-[17px] leading-relaxed text-text-secondary max-w-[800px] mx-auto text-center md:text-left">
            AdsHunting began around a straightforward observation: teams can find more advertising than ever, but turning that volume into useful, organized creative intelligence is still unnecessarily difficult. The product is being built to close that gap.
          </p>
        </LandingContainer>
      </section>

      {/* 05 What Makes AdsHunting Different */}
      <section className="bg-white py-20 md:py-32 border-b border-border">
        <LandingContainer>
          <div className="max-w-[700px] mb-16 md:mb-20">
            <h2 className="text-[32px] md:text-[44px] font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
              Not another place to collect more ads.
            </h2>
            <p className="text-[17px] md:text-[19px] leading-relaxed text-text-secondary">
              AdsHunting is being designed to help users decide what deserves attention and control how that research moves through a team.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8 max-w-[1100px]">
             
             {/* Winner Score */}
             <div className="flex-1 bg-[#FCFDFB] border border-border rounded-[20px] p-8 md:p-12">
                <h3 className="text-[24px] font-bold text-text-primary mb-4">Prioritize what deserves attention.</h3>
                <p className="text-[16px] text-text-secondary leading-relaxed mb-10 max-w-[400px]">
                  Winner Score gives users a signal for which creatives are worth investigating first.
                </p>

                <div className="w-full bg-white border border-border rounded-xl p-6 shadow-sm max-w-[340px]">
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[13px] font-bold uppercase tracking-wider text-text-muted">Winner Score</span>
                     <Activity size={16} className="text-brand" />
                   </div>
                   <div className="flex items-end gap-3">
                     <span className="text-[48px] font-bold text-text-primary leading-none tracking-tighter">84</span>
                     <span className="text-[14px] font-semibold text-brand px-3 py-1 bg-brand/10 rounded-md mb-1">High</span>
                   </div>
                   <div className="w-full h-1.5 bg-surface-subtle rounded-full mt-4 overflow-hidden">
                     <div className="w-[84%] h-full bg-brand rounded-full" />
                   </div>
                </div>
             </div>

             {/* Public / Private Sharing */}
             <div className="flex-1 bg-[#FCFDFB] border border-border rounded-[20px] p-8 md:p-12">
                <h3 className="text-[24px] font-bold text-text-primary mb-4">Share research on your terms.</h3>
                <p className="text-[16px] text-text-secondary leading-relaxed mb-10 max-w-[400px]">
                  AdsHunting supports public or private sharing so users can control how creative research is accessed.
                </p>

                <div className="w-full bg-white border border-border rounded-xl p-6 shadow-sm max-w-[340px]">
                   <div className="flex bg-surface-subtle p-1 rounded-lg mb-6">
                      <div className="flex-1 bg-white rounded-md py-1.5 text-center shadow-sm text-[13px] font-semibold text-text-primary flex items-center justify-center gap-2">
                        <Globe2 size={14}/> Public
                      </div>
                      <div className="flex-1 rounded-md py-1.5 text-center text-[13px] font-medium text-text-secondary flex items-center justify-center gap-2">
                        <Lock size={14}/> Private
                      </div>
                   </div>
                   <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-[#FCFDFB]">
                      <span className="text-[13px] text-text-secondary truncate">adshunting.com/share/ad...</span>
                      <span className="text-[13px] font-medium text-brand cursor-pointer">Copy</span>
                   </div>
                </div>
             </div>

          </div>
        </LandingContainer>
      </section>

      {/* 06 Final CTA */}
      <section className="bg-[#F4F9F1] py-16 md:py-24">
        <LandingContainer>
           <div className="max-w-[1000px] mx-auto bg-white border border-brand/20 rounded-[20px] p-8 md:p-14 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex-1 text-center md:text-left">
                 <h2 className="text-[28px] md:text-[36px] leading-[1.1] font-bold text-text-primary mb-4">
                   See what deserves your attention.
                 </h2>
                 <p className="text-[16px] md:text-[18px] text-text-secondary">
                   Search creative, understand the context, and start building better research with AdsHunting.
                 </p>
              </div>
              
              <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto shrink-0">
                 <CTAButton href={authLinks.signUp} size="lg" className="w-full md:w-auto h-14 px-8 shadow-sm">
                   Start 7-Day Free Trial <ArrowRight size={18} className="ml-2" />
                 </CTAButton>
                 <a href={authLinks.signIn} className="text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors">
                   Already using AdsHunting? Sign In
                 </a>
              </div>
           </div>
        </LandingContainer>
      </section>

    </div>
  );
}
