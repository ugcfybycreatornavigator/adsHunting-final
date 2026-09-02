import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { Search, Tags, BarChart3, Bookmark, Share2 } from 'lucide-react';

export function CapabilityGridSection() {
  const capabilities = [
    { icon: Search, title: 'Discover Ads', desc: 'Search active and inactive ads by brand or keyword.' },
    { icon: BarChart3, title: 'Competitors', desc: 'Track structural patterns in competitor creatives.' },
    { icon: Tags, title: 'Brands', desc: 'Follow specific brands and monitor their creative output.' },
    { icon: Bookmark, title: 'Swipe Files', desc: 'Organize high-signal ads into custom folders.' },
    { icon: Share2, title: 'Shared Ads', desc: 'Collaborate with your team via public or private links.' },
    { icon: Search, title: 'Advanced Filters', desc: 'Narrow down by format, category, country and more.' },
  ];

  return (
    <section className="py-24 bg-slate-50 border-t border-border relative overflow-hidden">
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(94,169,32,0.05), transparent 50%)'
        }}
      />
      <LandingContainer className="relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-text-primary mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1000px] mx-auto">
          {capabilities.map((cap, i) => (
            <div key={i} className="bg-white rounded-[16px] border border-border p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-blue text-brand flex items-center justify-center">
                <cap.icon size={20} />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-text-primary mb-1">{cap.title}</h3>
                <p className="text-[14px] text-text-secondary leading-relaxed">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
