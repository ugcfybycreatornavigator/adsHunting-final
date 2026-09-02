'use client';

import React, { useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { Globe, Lock, Copy, Check, ArrowRight } from 'lucide-react';

export function IntelligenceSharingSection() {
  const [hookScore, setHookScore] = useState(0);
  const [shareMode, setShareMode] = useState<'public' | 'private'>('public');
  const [isCopied, setIsCopied] = useState(false);
  const sectionRef = React.useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.4 });

  useEffect(() => {
    if (isInView) {
      const end = 84;
      const duration = 800;
      const startTime = performance.now();

      const animateScore = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        setHookScore(Math.floor(easeOut * end));

        if (progress < 1) {
          requestAnimationFrame(animateScore);
        }
      };
      
      requestAnimationFrame(animateScore);
    }
  }, [isInView]);

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  };

  return (
    <section 
      ref={sectionRef}
      className="py-[64px] md:py-[80px] lg:py-[96px] relative overflow-hidden bg-slate-50 border-t border-border"
    >
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 45%, rgba(94,169,32,0.05), transparent 34%)'
        }}
      />
      
      <LandingContainer className="relative z-10">
        
        {/* Editorial Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-11 gap-6">
          <div className="max-w-[560px]">
            <div className="flex items-center gap-3 mb-4 md:mb-5">
              <span className="w-2 h-2 rounded-full bg-brand"></span>
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-primary">
                WHY ADSHUNTING
              </span>
            </div>
            <h2 className="text-[34px] md:text-[44px] lg:text-[48px] leading-[1.05] font-[600] tracking-[-0.035em] text-text-primary text-balance mb-4">
              Find the signal.<br className="hidden md:block"/> Share the intelligence.
            </h2>
            <p className="text-[16px] md:text-[17px] leading-relaxed text-text-secondary">
              Prioritize high-signal creative and control exactly how your research gets shared.
            </p>
          </div>
          {/* Desktop CTA */}
          <div className="hidden md:block flex-shrink-0 pb-1">
            <CTAButton href={authLinks.signUp} className="h-[48px] rounded-[12px] text-[15px] font-[600] px-6 shadow-sm hover:shadow-md transition-all hover:bg-brand-strong group">
              Start 7-Day Free Trial <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5 inline-block" />
            </CTAButton>
          </div>
        </div>

        {/* Unified Premium Surface */}
        <motion.div 
          className="w-full max-w-[1240px] mx-auto bg-[rgba(255,255,255,0.92)] backdrop-blur-md rounded-[24px] md:rounded-[28px] overflow-hidden flex flex-col md:flex-row relative"
          style={{
            border: '1px solid rgba(20,30,20,0.08)',
            boxShadow: '0 24px 60px rgba(35,55,25,0.06), 0 6px 20px rgba(0,0,0,0.025)'
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Subtle top inner highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-white opacity-80 pointer-events-none" />

          {/* Left Panel: Winner Score */}
          <div className="w-full md:w-[50%] p-8 md:p-10 flex flex-col justify-center">
            
            <div className="mb-8">
               <span className="inline-block text-[11px] font-semibold tracking-widest text-text-muted uppercase mb-2">Winner Score</span>
               <h3 className="text-[22px] md:text-[24px] font-[600] text-text-primary tracking-tight">Know what deserves attention first.</h3>
            </div>

            {/* Editorial Score UI */}
            <div className="flex items-center gap-6">
               <motion.div 
                 className="w-[70px] h-[90px] md:w-[80px] md:h-[105px] rounded-[14px] overflow-hidden flex-shrink-0 shadow-sm relative"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                 transition={{ delay: 0.1, duration: 0.4 }}
               >
                 <img src="/brand/creatives/creative_fashion_01.jpg" alt="Creative" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 border border-black/5 rounded-[14px] pointer-events-none" style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.08)' }} />
               </motion.div>

               <div className="flex-1 max-w-[200px]">
                 <div className="flex items-end justify-between mb-2">
                   <span className="text-[13px] font-medium text-text-secondary">Winner Score</span>
                   <span className="text-[32px] md:text-[40px] font-semibold text-[#1A1A1A] leading-none tracking-tight">
                     {hookScore} <span className="text-[14px] font-medium text-text-muted">/100</span>
                   </span>
                 </div>
                 
                 <div className="w-full h-[6px] bg-line rounded-full overflow-hidden mb-3">
                   <motion.div 
                     className="h-full bg-brand rounded-full"
                     initial={{ width: '0%' }}
                     animate={isInView ? { width: '84%' } : { width: '0%' }}
                     transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                   />
                 </div>

                 <motion.div 
                   className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-blue border border-brand/20 text-brand-strong text-[11px] font-semibold tracking-wide"
                   initial={{ opacity: 0, y: 5 }}
                   animate={isInView && hookScore > 60 ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
                   transition={{ delay: 0.8, duration: 0.3 }}
                 >
                   High Signal
                 </motion.div>
               </div>
            </div>

          </div>

          {/* Center Divider with Arrow (Desktop) */}
          <div className="hidden md:flex w-px relative items-center justify-center" style={{ backgroundColor: 'rgba(20,30,20,0.08)' }}>
            <div className="absolute w-7 h-7 rounded-full bg-white border flex items-center justify-center text-text-muted z-10" style={{ borderColor: 'rgba(20,30,20,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <ArrowRight size={14} />
            </div>
          </div>
          {/* Mobile Divider */}
          <div className="h-px w-full md:hidden" style={{ backgroundColor: 'rgba(20,30,20,0.08)' }} />

          {/* Right Panel: Smart Sharing */}
          <div className="w-full md:w-[50%] p-8 md:p-10 flex flex-col justify-center bg-[#FAFAFC]">
            
            <div className="mb-8">
               <span className="inline-block text-[11px] font-semibold tracking-widest text-text-muted uppercase mb-2">Smart Sharing</span>
               <h3 className="text-[22px] md:text-[24px] font-[600] text-text-primary tracking-tight">Share on your terms.</h3>
            </div>

            {/* Segmented Control */}
            <div className="max-w-[340px]">
              <span className="block text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-2">Visibility</span>
              
              <div className="flex p-[3px] bg-slate-100 border border-line rounded-[10px] mb-3">
                <button 
                  onClick={() => setShareMode('public')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-[7px] transition-all duration-200 ${shareMode === 'public' ? 'bg-white text-text-primary shadow-sm border border-border/50' : 'text-text-muted hover:text-text-primary border border-transparent'}`}
                >
                  <Globe size={14} className={shareMode === 'public' ? 'text-brand' : ''} /> Public
                </button>
                <button 
                  onClick={() => setShareMode('private')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-medium rounded-[7px] transition-all duration-200 ${shareMode === 'private' ? 'bg-white text-text-primary shadow-sm border border-border/50' : 'text-text-muted hover:text-text-primary border border-transparent'}`}
                >
                  <Lock size={14} className={shareMode === 'private' ? 'text-brand' : ''} /> Private
                </button>
              </div>
              
              <p className="text-[13px] text-text-secondary mb-5 h-[20px] transition-opacity duration-200">
                {shareMode === 'public' ? 'Anyone with the link can view.' : 'Access follows your current private-sharing rules.'}
              </p>

              {/* Link Field */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#FAFAFA] border border-line rounded-[12px] px-3 py-2.5 text-[13px] text-text-secondary font-mono truncate" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                  adshunting.../share/8F2...
                </div>
                <button 
                  onClick={handleCopy}
                  className={`flex-shrink-0 flex items-center justify-center gap-1.5 h-[40px] px-3.5 rounded-[12px] border shadow-sm text-[13px] font-medium transition-colors w-[85px] ${isCopied ? 'bg-surface-blue border-brand/30 text-brand' : 'bg-white border-border text-text-primary hover:bg-surface'}`}
                >
                  {isCopied ? <><Check size={14} /> Copied</> : <><Copy size={13} className="text-text-muted"/> Copy</>}
                </button>
              </div>
            </div>

          </div>

        </motion.div>

        {/* Mobile CTA */}
        <div className="md:hidden mt-8 flex justify-center">
          <CTAButton href={authLinks.signUp} className="w-full h-[48px] rounded-[14px] text-[15px] font-[600] shadow-sm flex items-center justify-center group">
            Start 7-Day Free Trial <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5 inline-block" />
          </CTAButton>
        </div>

      </LandingContainer>
    </section>
  );
}
