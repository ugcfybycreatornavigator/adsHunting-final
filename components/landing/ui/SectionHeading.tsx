import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  centered = true,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-4', centered && 'items-center text-center', className)}>
      {eyebrow && (
        <span className="text-brand font-semibold text-sm tracking-wide uppercase">
          {eyebrow}
        </span>
      )}
      <h2 className="text-[30px] md:text-[40px] lg:text-[48px] leading-[1.1] font-bold tracking-tight text-text-primary text-balance max-w-3xl">
        {title}
      </h2>
      {description && (
        <p className="text-[15px] md:text-[17px] leading-relaxed text-text-secondary max-w-2xl text-balance mt-2">
          {description}
        </p>
      )}
    </div>
  );
}
