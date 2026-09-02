import React from 'react';
import { Metadata } from 'next';
import { ResourceContainer } from '@/components/resources/ResourceContainer';
import { ResourceHero } from '@/components/resources/ResourceHero';
import { ResourceCTA } from '@/components/resources/ResourceCTA';
import { ResourceRelatedLinks } from '@/components/resources/ResourceRelatedLinks';
import { ResourceGuideNav } from '@/components/resources/ResourceGuideNav';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'Creative Ad Research Guide',
  description: 'A practical guide to researching advertising creatives, identifying patterns and organizing useful references.',
  path: '/resources/creative-research',
});

export default function CreativeResearchPage() {
  return (
    <ResourceContainer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Resources', path: '/resources' },
              { name: 'Creative Research Guide', path: '/resources/creative-research' },
            ]),
          ),
        }}
      />
      <ResourceHero
        breadcrumbTitle="Creative Research Guide"
        eyebrow="GUIDE"
        title="A practical guide to creative ad research."
        description="Learn how to review advertising creatives systematically, organize useful references, and turn research into clearer creative direction."
      />

      <ResourceGuideNav 
        items={[
          { id: 'start-with-question', label: 'Start with a question' },
          { id: 'observe-before-assuming', label: 'Observe before assuming' },
          { id: 'review-systematically', label: 'Review creatively' },
          { id: 'look-for-patterns', label: 'Look for patterns' },
          { id: 'save-with-reason', label: 'Save deliberately' },
          { id: 'inform-creative-brief', label: 'Inform creative brief' }
        ]}
      />

      <div className="space-y-16 md:space-y-20 max-w-[760px] mx-auto">
        {/* Section 1 */}
        <section id="start-with-question">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Start with a research question.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Aimless browsing creates noise. Before you begin searching, define what you are trying to learn. This narrows your focus and helps you filter out irrelevant creatives.
          </p>
          <div className="bg-surface-subtle border border-border p-6 md:p-8 rounded-[16px]">
            <h3 className="font-bold text-text-primary mb-4 text-[16px]">Examples of good research questions:</h3>
            <ul className="space-y-3 text-[15px] text-text-secondary list-disc pl-5 marker:text-border-strong">
              <li>How are competitors introducing the product?</li>
              <li>What creative formats appear repeatedly?</li>
              <li>How are offers being communicated?</li>
              <li>What hooks or opening structures are visible?</li>
              <li>Which creatives have remained active over longer periods where observable?</li>
            </ul>
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 2 */}
        <section id="observe-before-assuming">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Separate creative observation from performance assumptions.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            A critical principle of ad research is distinguishing between what you can actually see and what you assume. Focus entirely on observable data rather than guessing at private metrics.
          </p>
          
          <div className="w-[100vw] relative left-1/2 -translate-x-1/2 max-w-[1000px] px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-border p-6 rounded-[16px]">
              <h3 className="text-[16px] font-bold text-text-primary mb-3">Observable:</h3>
              <ul className="space-y-2 text-[15px] text-text-secondary">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Format</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Copy and hook</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Visual structure</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Advertiser</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Start date and runtime (where available)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Destination URL</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>Repeated patterns</li>
              </ul>
            </div>
            
            <div className="bg-[#fff9f9] border border-[#ffebeb] p-6 rounded-[16px]">
              <h3 className="text-[16px] font-bold text-text-primary mb-3">Not observable:</h3>
              <ul className="space-y-2 text-[15px] text-[#8a5a5a]">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>ROAS (Return on Ad Spend)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>CTR (Click-Through Rate)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>CPC or CPA</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>Purchases or sales</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>Revenue</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#ffc4c4]"></span>Actual profitability</li>
              </ul>
            </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 3 */}
        <section id="review-systematically">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Review the creative systematically.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-8">
            When you evaluate a creative, do not just glance at it. Deconstruct it manually into observable research dimensions.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 mt-8">
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">Hook</h3>
              <p className="text-[15px] text-text-secondary">What earns attention first?</p>
            </div>
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">Message</h3>
              <p className="text-[15px] text-text-secondary">What problem or idea is communicated?</p>
            </div>
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">Format</h3>
              <p className="text-[15px] text-text-secondary">What layout or media type is used?</p>
            </div>
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">Offer</h3>
              <p className="text-[15px] text-text-secondary">What commercial proposition is visible?</p>
            </div>
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">Proof</h3>
              <p className="text-[15px] text-text-secondary">What evidence or claims are shown?</p>
            </div>
            <div className="bg-[#fcfcfa] border border-[#e4e8e2] p-5 md:p-6 rounded-[16px]">
              <h3 className="font-bold text-text-primary text-[15px] uppercase tracking-wider mb-2">CTA</h3>
              <p className="text-[15px] text-text-secondary">What specific action is requested?</p>
            </div>
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 4 */}
        <section id="look-for-patterns">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Look for patterns, not isolated examples.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Comparing multiple ads manually can help identify broader strategic choices. You are looking for recurring formats, repeated hooks, common positioning, recurring offers, and overall creative consistency.
          </p>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 5 */}
        <section id="save-with-reason">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Save references with a reason.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Do not just stockpile creatives. Organize them intentionally. Here are some illustrative ways to structure a Swipe File library:
          </p>
          <div className="bg-surface-subtle border border-border p-5 rounded-[12px] font-mono text-[14px] text-text-secondary leading-loose max-w-[400px]">
            Competitors<br/>
            UGC References<br/>
            Product Demonstrations<br/>
            Offers<br/>
            Hooks<br/>
            Landing Page Ideas
          </div>
        </section>

        {/* Compact Checklist */}
        <section className="bg-[#fcfcfa] border border-[#e4e8e2] rounded-[16px] p-6 md:p-8">
          <h3 className="text-[18px] font-bold text-text-primary mb-5">Before saving an ad, ask:</h3>
          <ul className="space-y-4 text-[16px] text-text-secondary">
            <li className="flex gap-3"><span className="text-border-strong font-bold">01</span> What caught my attention?</li>
            <li className="flex gap-3"><span className="text-border-strong font-bold">02</span> What is the central message?</li>
            <li className="flex gap-3"><span className="text-border-strong font-bold">03</span> What format is being used?</li>
            <li className="flex gap-3"><span className="text-border-strong font-bold">04</span> What makes this reference useful?</li>
            <li className="flex gap-3"><span className="text-border-strong font-bold">05</span> Where should I organize it?</li>
          </ul>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 6 */}
        <section id="inform-creative-brief">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Turn research into a creative brief.
          </h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            Use your organized references to inform real decisions. A simple framework:
          </p>
          <div className="bg-surface-subtle border border-border p-6 rounded-[16px] flex flex-col md:flex-row md:items-center gap-4 text-[15px] font-medium text-text-primary">
            <span>Research question</span>
            <span className="text-border-strong rotate-90 md:rotate-0">→</span>
            <span>Relevant references</span>
            <span className="text-border-strong rotate-90 md:rotate-0">→</span>
            <span>Observed patterns</span>
            <span className="text-border-strong rotate-90 md:rotate-0">→</span>
            <span>Creative direction</span>
            <span className="text-border-strong rotate-90 md:rotate-0">→</span>
            <span>Concepts to explore</span>
          </div>
        </section>

        {/* Where AdsHunting fits */}
        <section className="border-t border-border pt-12">
          <h2 className="text-[24px] font-bold text-text-primary mb-4">Where AdsHunting fits.</h2>
          <p className="text-[17px] text-text-secondary leading-relaxed mb-6">
            AdsHunting helps centralize the discovery, review, organization, and sharing parts of this workflow.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14px] font-medium text-text-primary bg-white border border-[#e4e8e2] rounded-full px-4 py-2">Search</span>
            <span className="text-border-strong">→</span>
            <span className="text-[14px] font-medium text-text-primary bg-white border border-[#e4e8e2] rounded-full px-4 py-2">Review</span>
            <span className="text-border-strong">→</span>
            <span className="text-[14px] font-medium text-text-primary bg-white border border-[#e4e8e2] rounded-full px-4 py-2">Save</span>
            <span className="text-border-strong">→</span>
            <span className="text-[14px] font-medium text-text-primary bg-white border border-[#e4e8e2] rounded-full px-4 py-2">Share</span>
          </div>
        </section>
      </div>

      <ResourceCTA 
        title="Put the workflow into practice."
        secondaryText="See How AdsHunting Works"
        secondaryHref="/resources/how-it-works"
      />
      
      <ResourceRelatedLinks 
        links={[
          { text: 'How AdsHunting Works', href: '/resources/how-it-works' },
          { text: 'Competitor Ad Research', href: '/resources/competitor-ad-research' }
        ]}
      />
    </ResourceContainer>
  );
}
