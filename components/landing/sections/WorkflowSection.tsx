"use client";

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { CTAButton } from '../ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import Image from 'next/image';

const steps = [
  {
    id: '01',
    title: 'Discover',
    desc: 'Find ads worth studying.',
    body: 'Search across brands and creatives, then narrow results with filters built for competitive research.',
    image: '/images/how-it-works/discover-new.png',
    imageClass: 'object-contain object-center w-full h-full'
  },
  {
    id: '02',
    title: 'Review',
    desc: 'See the full creative context.',
    body: 'Inspect the ad, advertiser, platforms and available signals before deciding what matters.',
    image: '/images/how-it-works/review-v2.png',
    imageClass: 'object-contain object-center w-full h-full'
  },
  {
    id: '03',
    title: 'Research',
    desc: 'Go deeper on the brands behind the ads.',
    body: 'Move from an individual creative into broader brand and competitor intelligence.',
    image: '/images/how-it-works/research-v2.png',
    imageClass: 'object-contain object-center w-full h-full'
  },
  {
    id: '04',
    title: 'Save',
    desc: 'Turn inspiration into a system.',
    body: 'Save ads and organize them into Swipe Files for campaigns, hooks, formats or competitors.',
    image: '/images/how-it-works/save-new.png',
    imageClass: 'object-contain object-center w-full h-full'
  },
  {
    id: '05',
    title: 'Share',
    desc: 'Share the work, not screenshots.',
    body: 'Send selected ads or collections through the sharing workflow already built into AdsHunting.',
    image: '/images/how-it-works/share-new.png',
    imageClass: 'object-contain object-center w-full h-full scale-[1.02]'
  }
];

export function WorkflowSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  // We set up Intersection Observers for the text items to update the active step
  useEffect(() => {
    const stepElements = document.querySelectorAll('.workflow-step');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
          setActiveStep(index);
        }
      });
    }, {
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0.1
    });

    stepElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="workflow" className="py-24 md:py-32 bg-slate-50 border-y border-border relative">
      <LandingContainer>
        
        {/* Section Header */}
        <div className="max-w-[800px] mb-16 mx-auto text-center flex flex-col items-center">
          <span className="text-brand font-bold text-sm tracking-widest uppercase mb-4 block">
            How AdsHunting Works
          </span>
          <h2 className="text-[32px] md:text-[40px] font-bold text-text-primary mb-6 leading-[1.1]">
            From discovery to a reusable creative library.
          </h2>
          <p className="text-[18px] text-text-secondary leading-relaxed max-w-[600px]">
            Find the right ads, understand what matters, organize your research, and share it with your team.
          </p>
        </div>

        {/* Desktop Sticky Layout */}
        <div ref={containerRef} className="hidden lg:flex items-start gap-12 xl:gap-16 relative w-full">
          
          {/* Left Column (Text Steps) */}
          <div className="w-[35%] xl:w-[30%] py-[30vh] flex flex-col gap-[50vh] shrink-0">
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                data-index={idx}
                onClick={() => setActiveStep(idx)}
                className={cn(
                  "workflow-step transition-all duration-300 cursor-pointer",
                  activeStep === idx ? "opacity-100 translate-x-0" : "opacity-30 blur-[1px] -translate-x-4 hover:opacity-60"
                )}
              >
                <div className="text-brand font-bold text-sm mb-3 tracking-wide">{step.id} {step.title}</div>
                <h3 className="text-[32px] font-bold text-text-primary mb-4 leading-tight">{step.desc}</h3>
                <p className="text-text-secondary text-[18px] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Right Column (Sticky Image Frame) */}
          <div className="w-[70%] xl:w-[75%] sticky top-0 h-screen flex items-center justify-center shrink-0 -mr-[6vw] xl:-mr-[10vw] pt-12 lg:pt-16">
            <div className="w-full aspect-[16/10] bg-white rounded-2xl border border-border/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col transition-all duration-700 hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)]">
              
              {/* Subtle Browser Chrome */}
              <div className="h-12 border-b border-border bg-slate-50/80 backdrop-blur flex items-center px-5 gap-2.5 shrink-0 z-10">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <div className="mx-auto text-[12px] font-medium text-slate-400 tracking-widest uppercase">AdsHunting</div>
              </div>

              {/* Image Container */}
              <div className="relative bg-slate-50 overflow-hidden w-full h-full p-2">
                <AnimatePresence>
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-2 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    {steps[activeStep].image ? (
                      <Image 
                        src={steps[activeStep].image!}
                        alt={`AdsHunting ${steps[activeStep].title} interface`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 65vw"
                        quality={100}
                        priority={activeStep === 0}
                        className={steps[activeStep].imageClass}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-2xl mb-4 flex items-center justify-center">
                          <span className="text-2xl opacity-50">📷</span>
                        </div>
                        <p className="text-sm font-medium">Screenshot coming soon</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Stacked Layout */}
        <div className="flex flex-col gap-16 lg:hidden">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col">
              <div className="mb-6">
                <div className="text-brand font-bold text-sm mb-2">{step.id} {step.title}</div>
                <h3 className="text-[22px] font-bold text-text-primary mb-3 leading-snug">{step.desc}</h3>
                <p className="text-text-secondary text-[15px] leading-relaxed">{step.body}</p>
              </div>
              
              <div className="w-full bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                 <div className="h-8 border-b border-border bg-slate-50 flex items-center px-3 gap-1.5 shrink-0">
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                 </div>
                 <div className="relative bg-slate-100 w-full aspect-video">
                    {step.image ? (
                      <Image 
                        src={step.image}
                        alt={`AdsHunting ${step.title} interface`}
                        fill
                        sizes="100vw"
                        quality={100}
                        className={step.imageClass}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <p className="text-[13px] font-medium">Screenshot coming soon</p>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 md:mt-32 flex justify-center">
          <CTAButton href={authLinks.signUp} size="lg" className="h-14 px-10 text-[16px] shadow-lg shadow-brand/10">
            Start Your 7-Day Free Trial
          </CTAButton>
        </div>

      </LandingContainer>
    </section>
  );
}
