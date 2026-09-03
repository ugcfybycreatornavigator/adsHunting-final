import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { ArrowRight, ArrowDown } from 'lucide-react';

export function ProblemSection() {
  return (
    <section className="pt-[52px] md:pt-[80px] pb-[48px] md:pb-[72px] bg-[#FCFCFA]">
      <LandingContainer>
        <div className="text-center mb-[28px] md:mb-[40px]">
          <h2 className="text-[30px] md:text-[48px] font-bold text-text-primary mb-4 leading-[1.15] text-balance">
            Ad research gets messy fast.
          </h2>
          <p className="text-[17px] md:text-[19px] text-text-secondary max-w-[600px] mx-auto text-balance">
            Tabs, screenshots and scattered links make useful creative research harder to revisit.
          </p>
        </div>
        
        <div className="max-w-[1040px] mx-auto bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] overflow-hidden">
          <div className="flex flex-col md:flex-row relative">
            
            {/* Left Side - Fragmented Research */}
            <div className="flex-1 p-[20px] sm:p-[24px] md:p-[32px] lg:p-[36px]">
              <div className="mb-6">
                <span className="text-[11px] md:text-[12px] font-bold text-text-muted uppercase tracking-widest">
                  Before
                </span>
                <h3 className="text-[20px] md:text-[22px] font-semibold text-text-primary mt-2">
                  Fragmented research
                </h3>
              </div>
              <ul className="space-y-[12px] text-[15px] md:text-[16px] text-text-secondary">
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></span>
                  Browser tabs
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></span>
                  Screenshots
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></span>
                  Bookmarks
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></span>
                  Scattered links
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></span>
                  Random folders
                </li>
              </ul>
            </div>
            
            {/* Center Transition */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#ffffff] border border-[#e4e8e2]">
              <ArrowRight size={18} className="hidden md:block text-text-muted" />
              <ArrowDown size={18} className="md:hidden text-text-muted" />
            </div>

            <div className="md:hidden w-full h-px bg-[#e4e8e2]" />
            <div className="hidden md:block w-px bg-[#e4e8e2]" />

            {/* Right Side - With AdsHunting */}
            <div className="flex-1 p-[20px] sm:p-[24px] md:p-[32px] lg:p-[36px] bg-[#f9faf8]">
              <div className="mb-6">
                <span className="text-[11px] md:text-[12px] font-bold text-brand uppercase tracking-widest">
                  With AdsHunting
                </span>
                <h3 className="text-[20px] md:text-[22px] font-semibold text-text-primary mt-2">
                  AdsHunting workflow
                </h3>
              </div>
              <ul className="space-y-[12px] text-[15px] md:text-[16px] text-text-primary font-medium">
                <li className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-brand w-4">01</span>
                  Search
                </li>
                <li className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-brand w-4">02</span>
                  Review
                </li>
                <li className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-brand w-4">03</span>
                  Save
                </li>
                <li className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-brand w-4">04</span>
                  Organize
                </li>
                <li className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-brand w-4">05</span>
                  Share
                </li>
              </ul>
            </div>
            
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
