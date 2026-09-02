import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LandingContainer } from "@/components/landing/layout/LandingContainer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#fcfcfa]">
      <LandingContainer>
        <main className="mx-auto max-w-[820px] py-14 md:py-20">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-sm text-text-muted">
              <li>
                <Link href="/" className="hover:text-text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight size={14} />
                <span className="font-medium text-text-primary" aria-current="page">
                  {title}
                </span>
              </li>
            </ol>
          </nav>
          <span className="text-brand font-bold text-[12px] md:text-[13px] tracking-widest uppercase mb-4 block">
            LEGAL
          </span>
          <h1 className="text-[38px] md:text-[58px] leading-[1.04] font-extrabold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="mt-4 text-[15px] text-text-muted">Last updated: {updated}</p>
          <div className="mt-12 space-y-10 text-[16px] leading-relaxed text-text-secondary [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-text-primary">
            {children}
          </div>
        </main>
      </LandingContainer>
    </div>
  );
}
