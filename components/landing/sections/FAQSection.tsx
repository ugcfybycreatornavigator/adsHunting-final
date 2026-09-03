'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { homepageFaqs } from '@/data/landing/faq';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <section 
      id="faq" 
      className="py-[72px] md:py-[120px] bg-[#FCFDFB] border-t border-border relative overflow-hidden"
    >
      {/* Subtle background radial gradient */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at 15% 20%, rgba(94,169,32,0.045), transparent 32%)'
        }}
      />
      
      <LandingContainer className="relative z-10 max-w-[1360px]">
        <div className="flex flex-col md:flex-row gap-[72px] md:gap-[96px]">
          
          {/* Left Column: Context & Conversion */}
          <div className="w-full md:w-[38%]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-2 h-2 rounded-full bg-brand"></span>
              <span className="text-[14px] font-bold tracking-widest uppercase text-text-primary">
                FAQ
              </span>
            </div>
            
            <h2 className="text-[34px] md:text-[48px] font-bold text-text-primary leading-[1.05] mb-6">
              Everything you need to know.
            </h2>
            
            <p className="text-[16px] md:text-[17px] text-text-secondary leading-relaxed mb-10 max-w-[360px]">
              Quick answers about AdsHunting, creative research, saving, sharing and billing.
            </p>

            <div className="bg-white p-6 rounded-2xl border border-border/60 shadow-sm">
              <h3 className="font-bold text-[16px] text-text-primary mb-2">Still have questions?</h3>
              <p className="text-[14px] text-text-muted mb-5">Start experiencing the platform for yourself with full access.</p>
              <CTAButton href={authLinks.signUp} size="md" className="w-full justify-center">
                Start 7-Day Free Trial
              </CTAButton>
            </div>
          </div>

          {/* Right Column: Accordion */}
          <div className="w-full md:w-[62%] flex flex-col gap-4">
            {homepageFaqs.map((faq, i) => {
              const isOpen = openIndex === i;
              
              return (
                <div 
                  key={i} 
                  className={cn(
                    "group rounded-[18px] border transition-all duration-300",
                    isOpen 
                      ? "bg-surface-blue border-brand/20 shadow-sm" 
                      : "bg-white border-border hover:border-border-strong hover:bg-[#F8FAFC]"
                  )}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-[18px]"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                  >
                    <span className={cn(
                      "text-[17px] md:text-[18px] font-semibold pr-8 transition-colors duration-300",
                      isOpen ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                    )}>
                      {faq.question}
                    </span>
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300",
                      isOpen 
                        ? "bg-brand border-brand text-white" 
                        : "bg-surface-subtle border-border text-text-muted group-hover:text-text-primary group-hover:border-border-strong"
                    )}>
                      <Plus 
                        size={20} 
                        className={cn(
                          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          isOpen ? "rotate-45" : "rotate-0"
                        )} 
                      />
                    </div>
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-1 max-w-[660px]">
                          <p className="text-[15px] md:text-[16px] text-text-secondary leading-[1.6]">
                            {faq.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </LandingContainer>
    </section>
  );
}
