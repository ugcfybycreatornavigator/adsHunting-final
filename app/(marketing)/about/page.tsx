import type { Metadata } from 'next';
import { AboutContent } from '@/components/landing/about/AboutContent';
import { breadcrumbJsonLd, createMetadata, jsonLd } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'About AdsHunting',
  description: 'AdsHunting is a creative intelligence workspace built to help teams discover ads, understand competitor creative, organize inspiration, and share what matters.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'About', path: '/about' },
            ]),
          ),
        }}
      />
      <AboutContent />
    </>
  );
}
