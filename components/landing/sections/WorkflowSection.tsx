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
    image: '/images/how-it-works/discover.jpg',
    imageClass: 'object-cover object-left-top'
  },
  {
    id: '02',
    title: 'Review',
    desc: 'See the full creative context.',
    body: 'Inspect the ad, advertiser, platforms and available signals before deciding what matters.',
    image: '/images/how-it-works/review-new.png',
    imageClass: 'object-cover object-center scale-[1.02]'
  },
  {
    id: '03',
    title: 'Research',
    desc: 'Go deeper on the brands behind the ads.',
    body: 'Move from an individual creative into broader brand and competitor intelligence.',
    image: '/images/how-it-works/research.png',
    imageClass: 'object-cover object-left-top p-4'
  },
  {
    id: '04',
    title: 'Save',
    desc: 'Turn inspiration into a system.',
    body: 'Save ads and organize them into Swipe Files for campaigns, hooks, formats or competitors.',
    image: '/images/how-it-works/save.png',
    imageClass: 'object-cover object-left-top'
  },
  {
    id: '05',
    title: 'Share',
    desc: 'Share the work, not screenshots.',
    body: 'Send selected ads or collections through the sharing workflow already built into AdsHunting.',
    image: '/images/how-it-works/share.png',
    imageClass: 'object-cover object-center scale-[1.02]' // Scaled slightly to crop edges
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
        <div ref={containerRef} className="hidden lg:flex items-start gap-16 relative">
          
          {/* Left Column (Text Steps) */}
          <div className="w-[35%] py-32 flex flex-col gap-[40vh]">
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                data-index={idx}
                className={cn(
                  "workflow-step transition-all duration-500",
                  activeStep === idx ? "opacity-100" : "opacity-30 blur-[1px]"
                )}
              >
                <div className="text-brand font-bold text-sm mb-3">{step.id} {step.title}</div>
                <h3 className="text-2xl font-bold text-text-primary mb-4 leading-snug">{step.desc}</h3>
                <p className="text-text-secondary text-[16px] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Right Column (Sticky Image Frame) */}
          <div className="w-[65%] sticky top-32 h-[75vh] min-h-[500px] max-h-[800px] bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            
            {/* Subtle Browser Chrome */}
            <div className="h-10 border-b border-border bg-slate-50 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
              </div>
              <div className="mx-auto text-[11px] font-semibold text-slate-400 tracking-wider uppercase">AdsHunting</div>
            </div>

            {/* Image Container */}
            <div className="flex-1 relative bg-slate-100 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 12, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-100"
                >
                  {steps[activeStep].image ? (
                    <Image 
                      src={steps[activeStep].image!}
                      alt={`AdsHunting ${steps[activeStep].title} interface`}
                      fill
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

        {/* Mobile / Tablet Stacked Layout */}
        <div className="flex flex-col gap-16 lg:hidden">
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col">
              <div className="mb-6">
                <div className="text-brand font-bold text-sm mb-2">{step.id} {step.title}</div>
                <h3 className="text-[22px] font-bold text-text-primary mb-3 leading-snug">{step.desc}</h3>
                <p className="text-text-secondary text-[15px] leading-relaxed">{step.body}</p>
              </div>
              
              <div className="w-full aspect-[4/3] sm:aspect-[16/10] bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                 <div className="h-8 border-b border-border bg-slate-50 flex items-center px-3 gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                   <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                 </div>
                 <div className="flex-1 relative bg-slate-100">
                    {step.image ? (
                      <Image 
                        src={step.image}
                        alt={`AdsHunting ${step.title} interface`}
                        fill
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
