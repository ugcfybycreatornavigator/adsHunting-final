import React from 'react';
import { Metadata } from 'next';
import { ResourceContainer } from '@/components/resources/ResourceContainer';
import { ResourceHero } from '@/components/resources/ResourceHero';
import { ResourceCTA } from '@/components/resources/ResourceCTA';
import { ResourceRelatedLinks } from '@/components/resources/ResourceRelatedLinks';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';


export const metadata: Metadata = createMetadata({
  title: 'How AdsHunting Works',
  description: 'Learn how AdsHunting helps you search, review, save, organize and share advertising creatives from one research workflow.',
  path: '/resources/how-it-works',
});

export default function HowItWorksPage() {
  return (
    <ResourceContainer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Resources', path: '/resources' },
              { name: 'How AdsHunting Works', path: '/resources/how-it-works' },
            ]),
          ),
        }}
      />
      <ResourceHero
        breadcrumbTitle="How AdsHunting Works"
        eyebrow="PRODUCT WORKFLOW"
        title="How AdsHunting works."
        description="AdsHunting brings ad discovery, review, organization, and sharing into one research workflow."
      />

      {/* Visual Workflow Diagram */}
      <div className="mb-16 md:mb-24 bg-[#FCFCFA] border border-[#e4e8e2] rounded-[24px] p-6 sm:p-8 md:p-12 max-w-[1000px] mx-auto overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-4 w-full relative">
          <div className="hidden md:block absolute top-[28px] left-0 right-0 h-px bg-[#e4e8e2] z-0"></div>

          <div className="md:hidden absolute left-[31px] top-4 bottom-4 w-px bg-[#e4e8e2] z-0"></div>

          {[
            { num: '01', title: 'Search', desc: 'Find relevant ads' },
            { num: '02', title: 'Review', desc: 'Inspect context' },
            { num: '03', title: 'Save', desc: 'Keep useful references' },
            { num: '04', title: 'Organize', desc: 'Structure research' },
            { num: '05', title: 'Share', desc: 'Send context' }
          ].map((step) => (
            <div key={step.title} className="flex md:flex-col items-center md:items-center md:justify-center md:text-center gap-4 z-10 bg-[#FCFCFA] md:px-3 relative w-full md:w-auto">
              <div className="w-14 h-14 shrink-0 rounded-full bg-surface-blue text-brand border border-[#d2dfcb] flex items-center justify-center font-bold text-[15px]">
                {step.num}
              </div>
              <div className="flex flex-col flex-1 md:flex-none">
                <span className="text-[16px] md:text-[17px] font-bold text-text-primary">{step.title}</span>
                <span className="text-[14px] text-text-secondary leading-tight mt-1">{step.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-16 md:space-y-20 max-w-[760px] mx-auto">
        {/* Section 01 */}
        <section>
          <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-3 block">01 — Search</span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Start with a brand, keyword, or research idea.
          </h2>
          <p className="text-[17px] md:text-[18px] text-text-secondary leading-relaxed mb-6">
            Use AdsHunting to search available advertising creatives and narrow your research using supported filters.
          </p>
          <ul className="space-y-3 text-[16px] text-text-primary">
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Brand search</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Keyword search</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Suggestion flow</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Available filters (such as format and status)</li>
          </ul>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 02 */}
        <section>
          <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-3 block">02 — Review</span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Open the ad and review the available context.
          </h2>
          <p className="text-[17px] md:text-[18px] text-text-secondary leading-relaxed mb-6">
            AdsHunting provides observable contextual information about the creative, helping you understand how it is being used in the market.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-surface-subtle border border-border p-5 rounded-[16px]">
              <h4 className="font-bold text-text-primary mb-3">Supported context:</h4>
              <ul className="space-y-2 text-[15px] text-text-secondary">
                <li>Advertiser</li>
                <li>Ad status (Active/Inactive)</li>
                <li>Creative format</li>
                <li>Primary text &amp; caption</li>
                <li>Start date &amp; runtime (where calculable)</li>
                <li>Media &amp; destination (where available)</li>
                <li>Market &amp; location (where available)</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 03 */}
        <section>
          <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-3 block">03 — Save</span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Keep useful creatives in Swipe Files.
          </h2>
          <p className="text-[17px] md:text-[18px] text-text-secondary leading-relaxed">
            When you find a relevant creative, save it to a Swipe File to ensure you can revisit the reference later without losing track of it.
          </p>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 04 */}
        <section>
          <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-3 block">04 — Organize</span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Structure research around the way you work.
          </h2>
          <p className="text-[17px] md:text-[18px] text-text-secondary leading-relaxed">
            Use Swipe Files to group related references logically—whether by competitor, format, messaging hook, or specific campaign ideas.
          </p>
        </section>

        <div className="h-px bg-border max-w-[200px]" />

        {/* Section 05 */}
        <section>
          <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-3 block">05 — Share</span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-5 text-balance">
            Share an ad without losing its context.
          </h2>
          <p className="text-[17px] md:text-[18px] text-text-secondary leading-relaxed mb-6">
            Research is meant to be shared. AdsHunting allows you to create share links so teammates or clients can review the creative and its context.
          </p>
          <ul className="space-y-3 text-[16px] text-text-primary">
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Create a public or auth-gated share link</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> View shared ads</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Manage active links</li>
            <li className="flex items-start gap-3"><span className="text-brand mt-1">•</span> Disable links when no longer needed</li>
          </ul>
        </section>
      </div>

      {/* Transparency Section */}
      <section className="bg-[#FCFCFA] border border-[#e4e8e2] rounded-[24px] py-12 md:py-16 my-16 md:my-24 max-w-[1000px] mx-auto px-6 md:px-12">
        <div className="max-w-[760px] mx-auto">
          <h2 className="text-[28px] md:text-[36px] font-bold text-text-primary leading-[1.2] mb-10 text-balance text-center">
            What AdsHunting does — and does not — show.
          </h2>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div>
              <h3 className="text-[18px] font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#68B32F]"></span>
                AdsHunting can help you review
              </h3>
              <ul className="space-y-3 text-[15px] text-text-secondary">
                <li>Observable ad creatives</li>
                <li>Advertiser information available through supported sources</li>
                <li>Available ad status, date, and context</li>
                <li>Creative formats</li>
                <li>Captions and media where available</li>
                <li>Organized saved references</li>
              </ul>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-text-primary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                AdsHunting does not claim access to
              </h3>
              <ul className="space-y-3 text-[15px] text-text-secondary">
                <li>ROAS (Return on Ad Spend)</li>
                <li>CTR (Click-Through Rate)</li>
                <li>CPC or CPA</li>
                <li>Sales or revenue</li>
                <li>Conversion rate or profitability</li>
                <li>Private Meta Ads Manager metrics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <ResourceCTA />

      <ResourceRelatedLinks
        links={[
          { text: 'Creative Research Guide', href: '/resources/creative-research' },
          { text: 'Competitor Ad Research', href: '/resources/competitor-ad-research' }
        ]}
      />
    </ResourceContainer>
  );
}
