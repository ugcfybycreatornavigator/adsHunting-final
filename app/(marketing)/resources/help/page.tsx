import React from 'react';
import { Metadata } from 'next';
import { ResourceContainer } from '@/components/resources/ResourceContainer';
import { ResourceHero } from '@/components/resources/ResourceHero';
import { ResourceCTA } from '@/components/resources/ResourceCTA';
import { ResourceRelatedLinks } from '@/components/resources/ResourceRelatedLinks';
import { HelpClient } from '@/components/resources/HelpClient';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'AdsHunting Help & FAQ',
  description: 'Answers about AdsHunting. Understand what the product does, what information is available, and how the core research workflow works.',
  path: '/resources/help',
});

export default function HelpPage() {
  return (
    <ResourceContainer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Resources', path: '/resources' },
              { name: 'Help & FAQ', path: '/resources/help' },
            ]),
          ),
        }}
      />
      <ResourceHero
        breadcrumbTitle="Help & FAQ"
        eyebrow="HELP & FAQ"
        title="Answers about AdsHunting."
        description="Understand what the product does, what information is available, and how the core research workflow works."
      />

      <HelpClient />

      <ResourceCTA 
        title="Still have questions?"
        description="The best way to learn how AdsHunting works is to try it yourself."
        secondaryText="See How AdsHunting Works"
        secondaryHref="/resources/how-it-works"
      />
      
      <ResourceRelatedLinks 
        links={[
          { text: 'How AdsHunting Works', href: '/resources/how-it-works' },
          { text: 'Creative Research Guide', href: '/resources/creative-research' },
          { text: 'Competitor Ad Research', href: '/resources/competitor-ad-research' }
        ]}
      />
    </ResourceContainer>
  );
}
