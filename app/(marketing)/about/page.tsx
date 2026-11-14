import React from 'react';
import { Metadata } from 'next';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { createMetadata } from '@/lib/seo';
import { CTAButton } from '@/components/landing/ui/CTAButton';
import { authLinks } from '@/data/landing/config';
import { Target, Search, FolderOpen, Share2 } from 'lucide-react';

export const metadata: Metadata = createMetadata({
  title: 'About Us | AdsHunting',
  description: 'Learn more about AdsHunting, the platform built for marketers and creatives to discover, save, and share ad intelligence.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="pt-[140px] md:pt-[180px] pb-24 min-h-screen bg-background selection:bg-brand-soft selection:text-brand-strong">

      {/* Hero Section */}
      <LandingContainer className="text-center max-w-[900px] mb-20 md:mb-32">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary tracking-tight mb-6 max-w-[1200px] mx-auto text-balance">
          Building the ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-strong">ad intelligence</span> workspace.
        </h1>
        <p className="text-xl md:text-2xl text-text-secondary leading-relaxed max-w-[700px] mx-auto">
          We&apos;re on a mission to give marketers, media buyers, and creative teams a dedicated platform to discover high-signal ads, organize them into actionable swipe files, and collaborate seamlessly.
        </p>
      </LandingContainer>

      {/* The Story / Problem Section */}
      <section className="bg-surface-subtle py-20 border-y border-border">
        <LandingContainer className="max-w-[1000px]">
          <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-center">
            <div className="flex-1 space-y-6">
              <span className="text-brand font-bold tracking-widest uppercase text-sm">Our Story</span>
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight">
                Born out of a simple, everyday frustration.
              </h2>
              <p className="text-lg text-text-secondary leading-relaxed">
                While there are countless tools to track ad spend and analytics, finding, organizing, and sharing the actual <em>creatives</em> that drive those metrics has always been a messy process involving scattered screenshots, broken links, and disorganized spreadsheets.
              </p>
              <p className="text-lg text-text-secondary leading-relaxed">
                We believe that creative is the most important variable in modern advertising. We built AdsHunting to solve this problem once and for all.
              </p>
            </div>
            <div className="flex-1 w-full relative">
              <div className="aspect-square md:aspect-[4/3] bg-gradient-to-br from-brand-soft to-surface rounded-3xl border border-border shadow-inner flex items-center justify-center p-8 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-brand/10 rounded-full blur-3xl"></div>

                <img
                  src="/images/about-illustration.jpg"
                  alt="AdsHunting Workspace"
                  className="w-full h-full object-cover relative z-10 rounded-2xl border border-border shadow-sm mix-blend-multiply opacity-90"
                />
              </div>
            </div>
          </div>
        </LandingContainer>
      </section>

      {/* Features Grid */}
      <section className="py-20 md:py-32">
        <LandingContainer>
          <div className="text-center max-w-[700px] mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-6">What We Do</h2>
            <p className="text-lg text-text-secondary">
              AdsHunting provides a comprehensive suite of tools designed for the modern marketer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-[1200px] mx-auto">
            {/* Feature 1 */}
            <div className="bg-white rounded-[24px] p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mb-6">
                <Search size={24} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Discover</h3>
              <p className="text-text-secondary leading-relaxed">
                Search through thousands of active and historical ad creatives to find exactly what you need.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-[24px] p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Target size={24} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Save</h3>
              <p className="text-text-secondary leading-relaxed">
                Instantly capture ads with our tools and save them forever, even if the original campaign is turned off.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-[24px] p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                <FolderOpen size={24} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Organize</h3>
              <p className="text-text-secondary leading-relaxed">
                Categorize your findings with tags, brands, and dedicated swipe files for easy retrieval.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-[24px] p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Share2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-3">Share</h3>
              <p className="text-text-secondary leading-relaxed">
                Generate secure, beautiful share links to collaborate with clients or internal teams.
              </p>
            </div>
          </div>
        </LandingContainer>
      </section>

      {/* CTA / Contact Section */}
      <LandingContainer className="max-w-[800px] text-center">
        <div className="bg-brand/5 border border-brand/10 rounded-[32px] p-10 md:p-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-6">Ready to level up your ad research?</h2>
          <p className="text-lg text-text-secondary mb-10 max-w-[500px] mx-auto">
            We&apos;re constantly improving the platform based on feedback from our users. Join us today and build your ultimate swipe file.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <CTAButton href={authLinks.signUp} size="lg" className="w-full sm:w-auto px-8">
              Get Early Access
            </CTAButton>
            <a href="mailto:hello@adshunting.com" className="text-text-secondary hover:text-text-primary font-medium px-6 py-3 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </LandingContainer>

    </div>
  );
}
