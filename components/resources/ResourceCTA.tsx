import React from 'react';
import Link from 'next/link';
import { CTAButton } from '../landing/ui/CTAButton';

export function ResourceCTA({
  title = "Ready to explore AdsHunting?",
  description = "Try the complete research workflow for 7 days.",
  secondaryText,
  secondaryHref
}: {
  title?: string;
  description?: string;
  secondaryText?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="mt-16 md:mt-24 w-full max-w-[900px] mx-auto bg-[#fcfcfa] border border-[#e4e8e2] rounded-[24px] p-8 md:p-12 flex flex-col items-center text-center">
      <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary mb-4">
        {title}
      </h2>
      <p className="text-[17px] md:text-[19px] text-text-secondary mb-8">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
        <CTAButton href="/sign-up" className="w-full sm:w-auto h-12 px-8 text-base font-semibold">
          Start 7-Day Free Trial
        </CTAButton>
        {secondaryText && secondaryHref && (
          <Link href={secondaryHref} className="text-brand font-medium hover:text-brand-strong transition-colors underline-offset-4 hover:underline px-4 py-2">
            {secondaryText}
          </Link>
        )}
      </div>
    </div>
  );
}
