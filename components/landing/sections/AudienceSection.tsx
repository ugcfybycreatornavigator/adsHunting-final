'use client';

import React, { useState } from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

type RoleData = {
  id: string;
  tabLabel: string;
  headline: string;
  description: string;
  workflow: string[];
};

const roles: RoleData[] = [
  {
    id: 'performance',
    tabLabel: 'Performance Marketers',
    headline: 'Research before deciding what to test.',
    description: 'Review competitor advertising activity, compare creative approaches, and keep useful references organized.',
    workflow: ['Search ads', 'Review creatives', 'Save references'],
  },
  {
    id: 'strategists',
    tabLabel: 'Creative Strategists',
    headline: 'Turn scattered inspiration into usable references.',
    description: 'Discover creative approaches, organize useful examples, and revisit them when building new directions.',
    workflow: ['Discover', 'Organize', 'Revisit'],
  },
  {
    id: 'agencies',
    tabLabel: 'Agencies',
    headline: 'Keep client research easier to organize and share.',
    description: 'Research brands, save relevant creatives, and share advertising references with clients or internal teams.',
    workflow: ['Research', 'Save', 'Share'],
  },
  {
    id: 'd2c',
    tabLabel: 'D2C Teams',
    headline: 'Stay closer to how your category is advertising.',
    description: 'Review competitor creatives and maintain an organized library of useful advertising references.',
    workflow: ['Research', 'Review', 'Organize'],
  },
];

export function AudienceSection() {
  const [activeTab, setActiveTab] = useState<string>('performance');

  return (
    <section className="pt-[52px] pb-[36px] md:pt-[64px] md:pb-[44px] lg:pt-[88px] lg:pb-[48px] bg-transparent md:bg-[#F6F8F3]/40 border-t border-border">
      <LandingContainer className="max-w-[1000px]">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-[28px] md:mb-[36px]">
          <span className="text-[#3c7a1f] font-semibold text-[11px] md:text-[12px] tracking-[0.1em] uppercase mb-3">
            Built for your workflow
          </span>
          <h2 className="text-[30px] md:text-[40px] lg:text-[48px] leading-[1.15] font-bold tracking-tight text-text-primary text-balance max-w-[720px]">
            Built around how ads creative research actually gets done.
          </h2>
          <p className="text-[15px] md:text-[17px] leading-relaxed text-text-secondary max-w-[620px] text-balance mt-4 font-normal">
            From competitor research to organizing creative references, AdsHunting keeps the essential workflow in one place.
          </p>
        </div>

        {/* Tab Rail Navigation */}
        <div className="relative max-w-[800px] mx-auto mb-[24px] md:mb-[28px]">
          {/* Subtle horizontal scroll container on mobile, flex row on desktop */}
          <div className="overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <div
              role="tablist"
              aria-label="Audience Workflows"
              className="flex items-center min-w-max md:min-w-0 md:justify-center bg-white/75 backdrop-blur-sm border border-[#e4e8e2] rounded-[16px] shadow-[0_6px_24px_rgba(25,40,20,0.035)] p-1 md:p-1.5 gap-1"
            >
              {roles.map((role) => {
                const isActive = activeTab === role.id;
                return (
                  <button
                    key={role.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${role.id}`}
                    id={`tab-${role.id}`}
                    onClick={() => setActiveTab(role.id)}
                    className={cn(
                      "relative px-4 py-2 text-[14px] md:text-[15px] whitespace-nowrap rounded-[12px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                      isActive
                        ? "text-text-primary font-medium bg-[#f3f7ef] shadow-sm"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-normal"
                    )}
                  >
                    <span className="relative z-10">{role.tabLabel}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[24px] h-[2px] bg-brand rounded-full animate-in fade-in zoom-in-90 duration-200" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Panel */}
        <div className="max-w-[700px] mx-auto text-center min-h-[140px] flex flex-col justify-center">
          {roles.map((role) => (
            <div
              key={role.id}
              role="tabpanel"
              id={`panel-${role.id}`}
              aria-labelledby={`tab-${role.id}`}
              hidden={activeTab !== role.id}
              className={cn(
                "flex flex-col items-center",
                activeTab === role.id ? "block animate-in fade-in slide-in-from-bottom-2 duration-200" : "hidden"
              )}
            >
              <h3 className="text-[20px] md:text-[24px] font-bold text-text-primary mb-2.5">
                {role.headline}
              </h3>
              <p className="text-[15px] md:text-[17px] text-text-secondary leading-relaxed max-w-[620px] mb-6 font-normal">
                {role.description}
              </p>

              {/* Compact Workflow Visual */}
              <div className="flex flex-wrap justify-center items-center gap-1.5 md:gap-3">
                {role.workflow.map((step, index) => (
                  <React.Fragment key={index}>
                    <span className="flex items-center gap-1.5 text-[13px] md:text-[14px] font-medium text-text-primary whitespace-nowrap bg-white border border-[#e4e8e2] rounded-full px-3 py-1.5 shadow-[0_1px_2px_rgba(20,30,20,0.015)]">
                      <span className="text-[10px] md:text-[11px] font-bold text-brand/60 uppercase tracking-wider">0{index + 1}</span>
                      {step}
                    </span>
                    {index < role.workflow.length - 1 && (
                      <ArrowRight size={14} strokeWidth={2.5} className="text-border-strong shrink-0 mx-0.5" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </LandingContainer>

      {/* Subtle transition divider */}
      <div className="max-w-[150px] mx-auto mt-[36px] md:mt-[44px] h-[1px] bg-gradient-to-r from-transparent via-[#e4e8e2] to-transparent"></div>
    </section>
  );
}
