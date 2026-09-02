import React from 'react';
import { Metadata } from 'next';
import { ResourceContainer } from '@/components/resources/ResourceContainer';
import { ResourceHero } from '@/components/resources/ResourceHero';
import { ResourceCTA } from '@/components/resources/ResourceCTA';
import { ResourceRelatedLinks } from '@/components/resources/ResourceRelatedLinks';
import { ResourceGuideNav } from '@/components/resources/ResourceGuideNav';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'Competitor Ad Research Guide',
  description: 'Learn how to research competitor advertising activity using observable creative information without relying on private performance metrics.',
  path: '/resources/competitor-ad-research',
});

export default function CompetitorAdResearchPage() {
  return (
    <ResourceContainer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Resources', path: '/resources' },
              { name: 'Competitor Ad Research Guide', path: '/resources/competitor-ad-research' },
            ]),
          ),
        }}
      />
      <ResourceHero
        breadcrumbTitle="Competitor Ad Research"
        eyebrow="COMPETITOR RESEARCH"
        title="How to research competitor ads without guessing."
        description="Focus on observable creative activity, messaging, formats, and patterns rather than private performance metrics you cannot actually see."
      />

      <ResourceGuideNav 
        items={[
          { id: 'start-with-competitors', label: 'Start with the right competitors' },
          { id: 'review-observable', label: 'Review what is observable' },
          { id: 'compare-patterns', label: 'Compare creative patterns' },
          { id: 'use-longevity-carefully', label: 'Use longevity carefully' },
          { id: 'build-swipe-file', label: 'Build a competitor Swipe File' },
          { id: 'share-findings', label: 'Share useful findings' }
        ]}
      />

      <div className="space-y-16 md:space-y-20 max-w-[760px] mx-auto">
        {/* Section 1 */}
        <section id="start-with-competitors">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Start with the right competitors.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Effective research begins with knowing who to observe. Do not limit your search solely to direct brand competitors. Consider widening your scope to include adjacent brands, category leaders, and companies solving similar customer problems in different ways.
          </p>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 2 */}
        <section id="review-observable">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Review what is actually observable.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-10">
            When reviewing a competitor’s advertising, it is crucial to clearly distinguish observable information from private metrics.
          </p>
          <div className="w-[100vw] relative left-1/2 -translate-x-1/2 max-w-[1000px] px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-border p-6 md:p-8 rounded-[16px]">
                <h3 className="text-[14px] font-bold text-text-primary uppercase tracking-wider mb-6">What you can observe</h3>
                <ul className="space-y-3 text-[15px] text-text-secondary">
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Active creatives</li>
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Ad format</li>
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Ad copy</li>
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Visible offer</li>
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Start date / runtime (where available)</li>
                  <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>CTA</li>
                </ul>
              </div>
              
              <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-6 md:p-8 rounded-[16px]">
                <h3 className="text-[14px] font-bold text-text-primary uppercase tracking-wider mb-6">What you cannot know</h3>
                <ul className="space-y-3 text-[15px] text-text-secondary opacity-80">
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>ROAS (Return on Ad Spend)</li>
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>CTR (Click-Through Rate)</li>
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>CPC or CPA</li>
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>Revenue</li>
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>Conversions</li>
                  <li className="flex items-center gap-3"><span className="text-text-muted text-[12px] font-mono">✕</span>Profitability</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 3 */}
        <section id="compare-patterns">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Compare creative patterns.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Individual ads rarely tell the whole story. The goal is to compare multiple creatives to identify strategic patterns. Use these practical questions to guide your manual research:
          </p>
          <ul className="space-y-3 text-[16px] text-text-primary bg-[#fcfcfa] border border-[#e4e8e2] rounded-[16px] p-6 md:p-8">
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Are they using more video or static imagery?</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> How are products introduced?</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Which messages repeat?</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Are they using creator-led content?</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Are offers prominent?</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> What creative structures recur?</li>
          </ul>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 4 */}
        <section id="use-longevity-carefully">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-8 text-balance">
            Use longevity carefully.
          </h2>
          <div className="bg-[#f2f6f0] border border-[#d2dfcb] rounded-[16px] p-6 md:p-10 mb-8 text-center max-w-[640px] mx-auto">
            <h3 className="text-[12px] font-bold text-brand uppercase tracking-widest mb-4">Longevity is context — not proof</h3>
            <p className="text-[20px] md:text-[24px] text-text-primary leading-snug font-medium font-serif">
              “Longer runtime can be useful context.<br />It is not proof of performance.”
            </p>
          </div>
          <p className="text-[17px] text-text-secondary leading-relaxed text-center max-w-[600px] mx-auto">
            Avoid the trap of assuming that a long-running ad is a guaranteed winner. It does not prove profitability, ROAS, conversions, or sales. Instead, view it as a signal that the advertiser has kept it active, which makes its format, hook, and messaging worth studying.
          </p>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 5 */}
        <section id="build-swipe-file">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Build a competitor Swipe File.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Keep your research organized. Create a structured reference library using Swipe Files. Here is an illustrative organizational structure:
          </p>
          <div className="bg-surface-subtle border border-border p-5 rounded-[12px] font-mono text-[14px] text-text-secondary leading-loose max-w-[400px]">
            Brand A<br/>
            Brand B<br/>
            Category References<br/>
            Hooks<br/>
            Offers<br/>
            Formats
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 6 */}
        <section id="share-findings">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Share useful findings.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Competitor research is most valuable when it informs your team. Using AdsHunting&apos;s Shared Ads functionality, you can easily share relevant creatives with teammates, clients, creative strategists, or other stakeholders while maintaining the necessary context.
          </p>
        </section>
      </div>

      <ResourceCTA 
        title="Start organizing competitor ad research."
        secondaryText="Learn How AdsHunting Works"
        secondaryHref="/resources/how-it-works"
      />
      
      <ResourceRelatedLinks 
        links={[
          { text: 'Creative Research Guide', href: '/resources/creative-research' },
          { text: 'Help & FAQ', href: '/resources/help' }
        ]}
      />
    </ResourceContainer>
  );
}
