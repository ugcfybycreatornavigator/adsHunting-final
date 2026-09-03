import React from 'react';
import { Metadata } from 'next';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { createMetadata } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'Privacy Policy | AdsHunting',
  description: 'Privacy Policy for AdsHunting. Learn how we collect, use, and protect your data.',
  path: '/privacy',
});

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-[140px] md:pt-[160px] pb-24 min-h-screen bg-background">
      <LandingContainer className="max-w-[800px] flex flex-col items-center text-center">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">Privacy Policy</h1>
          <p className="text-text-secondary">Last updated: September 2026</p>
        </div>

        <div className="prose prose-zinc max-w-none text-text-secondary prose-headings:text-text-primary prose-a:text-brand hover:prose-a:text-brand-strong">
          <p>
            At AdsHunting, we take your privacy seriously. This Privacy Policy describes how we collect, use, and handle your personal information when you use our website, products, and services (collectively, the &quot;Services&quot;).
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us when you:
          </p>
          <ul>
            <li>Create an account or purchase a subscription.</li>
            <li>Use our platform to save, organize, and share ad creatives.</li>
            <li>Communicate with our customer support.</li>
          </ul>
          <p>
            The types of information we may collect include your name, email address, payment information (processed securely via Stripe), and any other information you choose to provide.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide, maintain, and improve our Services.</li>
            <li>Process transactions and send related information, including confirmations and receipts.</li>
            <li>Send technical notices, updates, security alerts, and support messages.</li>
            <li>Respond to your comments, questions, and requests.</li>
          </ul>

          <h2>3. Data Security and Storage</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, modification, disclosure, or destruction. Your data is stored securely using industry-standard infrastructure (Supabase and Clerk).
          </p>

          <h2>4. Cookies and Tracking</h2>
          <p>
            We use cookies and similar tracking technologies to track activity on our Services and hold certain information to improve your user experience and analyze how our platform is used.
          </p>

          <h2>5. Your Rights</h2>
          <p>
            Depending on your location, you may have the right to access, correct, or delete your personal data. You can manage most of your data directly through your account settings or by contacting our support team.
          </p>

          <h2>6. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at <strong>support@adshunting.com</strong>.
          </p>
        </div>
      </LandingContainer>
    </div>
  );
}
