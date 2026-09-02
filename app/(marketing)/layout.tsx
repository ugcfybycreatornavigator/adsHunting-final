import React from 'react';
import { Navbar } from '@/components/landing/layout/Navbar';
import { Footer } from '@/components/landing/layout/Footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-brand-soft selection:text-brand-strong">
      <Navbar />
      <main>
        {children}
      </main>
      <Footer />
    </div>
  );
}
