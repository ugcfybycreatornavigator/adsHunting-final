import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function ResourceRelatedLinks({
  links
}: {
  links: { text: string; href: string }[];
}) {
  return (
    <div className="mt-16 md:mt-24 w-full max-w-[760px] mx-auto pt-8 border-t border-border">
      <h3 className="text-[14px] font-bold text-text-primary uppercase tracking-wider mb-6">
        Continue exploring
      </h3>
      <div className="flex flex-col gap-4">
        {links.map((link, idx) => (
          <Link key={idx} href={link.href} className="flex items-center justify-between group">
            <span className="text-[17px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">{link.text}</span>
            <ArrowRight size={18} className="text-text-muted group-hover:text-brand transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
