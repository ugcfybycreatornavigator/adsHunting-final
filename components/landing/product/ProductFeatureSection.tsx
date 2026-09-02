import React, { ReactNode } from 'react';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { cn } from '@/lib/utils';

export interface ProductFeatureSectionProps {
  step: string;
  title: string;
  description: string;
  visual: ReactNode;
  visualSide: 'left' | 'right';
  className?: string;
  id?: string;
}

export function ProductFeatureSection({
  step,
  title,
  description,
  visual,
  visualSide,
  className,
  id
}: ProductFeatureSectionProps) {
  return (
    <section 
      id={id} 
      className={cn(
        "py-[56px] md:py-[72px] lg:py-[96px] border-t border-[#e4e8e2] overflow-hidden",
        className
      )}
    >
      <LandingContainer>
        <div className="flex flex-col lg:flex-row items-center lg:items-center gap-12 lg:gap-16 xl:gap-24">
          
          <div 
            className={cn(
              "flex-1 text-center lg:text-left w-full max-w-[600px] mx-auto lg:mx-0 flex flex-col justify-center",
              visualSide === 'left' ? 'order-1 lg:order-2' : 'order-1 lg:order-1'
            )}
          >
            <span className="text-brand font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 block">
              {step}
            </span>
            <h2 className="text-[30px] md:text-[36px] lg:text-[44px] xl:text-[48px] font-bold text-text-primary leading-[1.15] mb-6 text-balance">
              {title}
            </h2>
            <p className="text-[17px] md:text-[19px] text-text-secondary leading-relaxed max-w-[540px] mx-auto lg:mx-0">
              {description}
            </p>
          </div>

          <div 
            className={cn(
              "flex-1 w-full relative",
              visualSide === 'left' ? 'order-2 lg:order-1' : 'order-2 lg:order-2'
            )}
          >
             {visual}
          </div>

        </div>
      </LandingContainer>
    </section>
  );
}
