import React from 'react';
import Link from 'next/link';

export function ResourceGuideNav({
  items
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <div className="w-full max-w-[760px] mx-auto mb-16 md:mb-24">
      <div className="border border-[#e4e8e2] rounded-[16px] bg-[#fcfcfa] p-5 md:p-6">
        <h2 className="text-[12px] font-bold text-text-primary uppercase tracking-widest mb-4">
          In this guide
        </h2>
        <nav aria-label="Guide navigation">
          <ul className="flex flex-col md:flex-row md:flex-wrap gap-y-3 gap-x-6">
            {items.map((item, index) => (
              <li key={item.id}>
                <Link 
                  href={`#${item.id}`}
                  className="flex items-center gap-3 text-[15px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="text-[#aeb5a9] font-bold text-[13px]">{String(index + 1).padStart(2, '0')}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
