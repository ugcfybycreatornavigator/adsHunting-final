import React from 'react';
import { ResourceBreadcrumbs } from './ResourceBreadcrumbs';

export function ResourceHero({
  eyebrow,
  title,
  description,
  breadcrumbTitle,
}: {
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbTitle: string;
}) {
  return (
    <div className="mb-16 md:mb-20 w-full max-w-[920px] mx-auto text-center flex flex-col items-center">
      <div className="w-full text-left mb-8 md:mb-10">
        <ResourceBreadcrumbs title={breadcrumbTitle} />
      </div>
      <span className="text-brand font-semibold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 md:mb-5 block">
        {eyebrow}
      </span>
      <h1 className="text-[36px] leading-[1.1] md:text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold tracking-tight text-text-primary text-balance mb-6 md:mb-8">
        {title}
      </h1>
      <p className="text-[17px] md:text-[19px] lg:text-[21px] text-text-secondary max-w-[680px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
