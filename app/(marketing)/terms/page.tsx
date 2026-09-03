import React from 'react';
import { Metadata } from 'next';
import { LandingContainer } from '@/components/landing/layout/LandingContainer';
import { createMetadata } from '@/lib/seo';

export const metadata: Metadata = createMetadata({
  title: 'Terms of Service | AdsHunting',
  description: 'Terms of Service for AdsHunting. Read the rules and regulations for using our platform.',
  path: '/terms',
});

export default function TermsOfServicePage() {
  return (
    <div className="pt-[140px] md:pt-[160px] pb-24 min-h-screen bg-background">
      <LandingContainer className="max-w-[800px] flex flex-col items-center text-center">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4 tracking-tight">Terms of Service</h1>
          <p className="text-text-secondary">Last updated: September 2026</p>
        </div>

        <div className="prose prose-zinc max-w-none text-text-secondary prose-headings:text-text-primary prose-a:text-brand hover:prose-a:text-brand-strong">
          <p>
            Welcome to AdsHunting. By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>

          <h2>1. Use of the Services</h2>
          <p>
            AdsHunting provides an ad intelligence platform that allows users to discover, organize, and share ad creatives. You agree to use the Services only for lawful purposes and in accordance with these Terms.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>

          <h2>2. Subscription and Billing</h2>
          <p>
            Some features of AdsHunting require a paid subscription. By subscribing, you agree to pay all applicable fees and taxes. Subscriptions automatically renew unless canceled prior to the end of the current billing cycle. All payments are processed securely via Stripe.
          </p>

          <h2>3. Intellectual Property</h2>
          <p>
            The AdsHunting platform, including its original content, features, and functionality, is owned by AdsHunting and is protected by international copyright, trademark, and other intellectual property laws. Ad creatives and external content saved via our platform remain the property of their respective owners.
          </p>

          <h2>4. User Content</h2>
          <p>
            You retain ownership of any notes, swipe files, or other content you create on the platform (&quot;User Content&quot;). By uploading or creating User Content, you grant us a license to use, store, and display that content solely for the purpose of providing the Services to you.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            In no event shall AdsHunting, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Services.
          </p>

          <h2>6. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. We will provide notice of any significant changes. Your continued use of the Services after any such changes constitutes your acceptance of the new Terms.
          </p>

          <h2>7. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at <strong>support@adshunting.com</strong>.
          </p>
        </div>
      </LandingContainer>
    </div>
  );
}
