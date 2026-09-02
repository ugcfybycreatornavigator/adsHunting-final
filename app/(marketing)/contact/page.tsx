import React from 'react';
import { Metadata } from 'next';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { ContactForm } from '@/components/contact/ContactForm';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'Contact AdsHunting',
  description: 'Contact AdsHunting with questions about the product, free trial, pricing, billing, or ad research workflow.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <div className="bg-[#fcfcfa] min-h-[calc(100vh-60px)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Contact', path: '/contact' },
            ]),
          ),
        }}
      />
      <LandingContainer>
        {/* Page Header / Hero */}
        <div className="pt-[48px] md:pt-[64px] lg:pt-[80px] pb-[44px] md:pb-[56px] text-left max-w-[1180px] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] font-medium text-text-muted mb-6">
            <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-text-primary">Contact</span>
          </div>

          <span className="text-brand font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 block">CONTACT</span>
          <h1 className="text-[34px] md:text-[44px] lg:text-[52px] font-bold text-text-primary leading-[1.1] mb-5 tracking-tight">
            Have a question about AdsHunting?
          </h1>
          <p className="text-[17px] md:text-[19px] text-text-secondary leading-relaxed max-w-[640px]">
            Send us a message about the product, your trial, pricing, billing, or your research workflow.
          </p>
        </div>

        {/* Main Content Layout */}
        <div className="pb-[72px] md:pb-[88px] max-w-[1180px] mx-auto">
          <div className="flex flex-col xl:flex-row gap-12 xl:gap-20">
            
            {/* Left Column: Information (approx 5-col equivalent) */}
            <div className="w-full xl:w-[40%] flex flex-col pt-2">
              <h2 className="text-[14px] font-bold text-text-primary uppercase tracking-widest mb-6">Get in Touch</h2>
              
              <div className="flex flex-col border-t border-[#e4e8e2]">
                
                <div className="py-6 border-b border-[#e4e8e2]">
                  <h3 className="text-[16px] font-bold text-text-primary mb-1">Product & General Questions</h3>
                  <p className="text-[15px] text-text-secondary leading-relaxed">
                    Questions about how AdsHunting works, supported workflows, or product access.
                  </p>
                </div>

                <div className="py-6 border-b border-[#e4e8e2]">
                  <h3 className="text-[16px] font-bold text-text-primary mb-1">Billing & Trial</h3>
                  <p className="text-[15px] text-text-secondary leading-relaxed">
                    Questions about the 7-day free trial, Scout plan, or subscription-related issues.
                  </p>
                </div>

                <div className="py-6 border-b border-[#e4e8e2]">
                  <h3 className="text-[16px] font-bold text-text-primary mb-1">Agencies & Teams</h3>
                  <p className="text-[15px] text-text-secondary leading-relaxed">
                    Questions about upcoming team or agency plans.
                  </p>
                </div>
                
              </div>

              {/* Small workflow context */}
              <div className="mt-8 pt-6 border-t border-[#e4e8e2]">
                <p className="text-[13px] font-medium text-text-muted flex items-center gap-2 flex-wrap">
                  Search <ChevronRight size={12} className="text-[#d2dfcb]" /> 
                  Review <ChevronRight size={12} className="text-[#d2dfcb]" /> 
                  Research <ChevronRight size={12} className="text-[#d2dfcb]" /> 
                  Save <ChevronRight size={12} className="text-[#d2dfcb]" /> 
                  Share
                </p>
              </div>

            </div>

            {/* Right Column: Form (approx 7-col equivalent) */}
            <div className="w-full xl:w-[60%]">
              <ContactForm />
            </div>

          </div>
        </div>
      </LandingContainer>
    </div>
  );
}
