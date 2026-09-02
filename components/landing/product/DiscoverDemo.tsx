'use client';

import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Image as ImageIcon, Video, Layers } from 'lucide-react';
import { demoAds } from '@/data/landing/demoAds';
import { cn } from '@/lib/utils';

export function DiscoverDemo() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  
  // 0: Initial search
  // 1: Typing
  // 2: Suggestions
  // 3: Results

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (step === 0) {
      timeout = setTimeout(() => setStep(1), 1000);
    } else if (step === 1) {
      timeout = setTimeout(() => setStep(2), 800);
    } else if (step === 2) {
      timeout = setTimeout(() => setStep(3), 1500);
    } else if (step === 3) {
      timeout = setTimeout(() => setStep(0), 4000);
    }
    return () => clearTimeout(timeout);
  }, [step]);

  return (
    <div className="w-full max-w-[560px] mx-auto bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] shadow-sm overflow-hidden flex flex-col h-[420px]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e4e8e2] flex items-center justify-between bg-[#fcfcfa] shrink-0">
        <h4 className="text-[14px] font-bold text-text-primary">Discover Ads</h4>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#e4e8e2]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#e4e8e2]"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#e4e8e2]"></div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 relative overflow-hidden">
        {/* Search Bar */}
        <div className="relative z-20">
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border bg-white transition-all duration-200",
            step > 1 ? "border-brand ring-1 ring-brand-soft" : "border-[#e4e8e2]"
          )}>
            <Search size={18} className="text-text-muted shrink-0" />
            <div className="flex-1 text-[15px]">
              {step === 0 && <span className="text-text-muted">Search brands or keywords...</span>}
              {step > 0 && <span className="text-text-primary font-medium">Frido<span className={cn("inline-block w-[2px] h-4 bg-brand ml-0.5 align-middle", step > 1 && "hidden animate-pulse")}></span></span>}
            </div>
          </div>

          {/* Suggestions Dropdown */}
          <div className={cn(
            "absolute top-full left-0 right-0 mt-2 bg-white border border-[#e4e8e2] rounded-xl shadow-md overflow-hidden transition-all duration-200 origin-top",
            step === 2 ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
          )}>
            <div className="py-2">
              <div className="px-4 py-2.5 hover:bg-[#f9faf8] cursor-pointer text-[14px] font-medium text-text-primary">
                Frido
              </div>
              <div className="px-4 py-2.5 hover:bg-[#f9faf8] cursor-pointer text-[14px] text-text-secondary">
                Frido India
              </div>
              <div className="px-4 py-2.5 hover:bg-[#f9faf8] cursor-pointer text-[14px] text-text-secondary">
                Frido Mobility
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className={cn(
          "flex-1 flex flex-col mt-5 transition-all duration-300",
          step === 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none absolute inset-x-5 top-[76px] bottom-5"
        )}>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 overflow-x-hidden pb-1 shrink-0">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#fcfcfa] border border-[#e4e8e2] rounded-lg text-[13px] font-medium text-text-primary shrink-0">
              <SlidersHorizontal size={14} className="text-text-muted" /> Filters
            </button>
            <span className="px-3 py-1.5 bg-[#eef4ec] border border-[#d2dfcb] text-brand rounded-lg text-[13px] font-bold shrink-0">
              Active
            </span>
            <span className="px-3 py-1.5 bg-[#fcfcfa] border border-[#e4e8e2] text-text-secondary rounded-lg text-[13px] font-medium shrink-0">
              Video
            </span>
            <span className="px-3 py-1.5 bg-[#fcfcfa] border border-[#e4e8e2] text-text-secondary rounded-lg text-[13px] font-medium shrink-0">
              United States
            </span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-hidden pr-1">
            {demoAds.slice(0, 3).map((ad) => (
              <div key={ad.id} className="group relative rounded-xl overflow-hidden border border-[#e4e8e2] bg-[#fcfcfa] aspect-[4/5]">
                { }
                <img src={ad.thumbnail} alt={ad.brand} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute top-2 left-2 flex gap-1">
                   {ad.format === 'video' && <div className="bg-black/50 backdrop-blur-md rounded px-1.5 py-1"><Video size={12} className="text-white" /></div>}
                   {ad.format === 'image' && <div className="bg-black/50 backdrop-blur-md rounded px-1.5 py-1"><ImageIcon size={12} className="text-white" /></div>}
                   {ad.format === 'carousel' && <div className="bg-black/50 backdrop-blur-md rounded px-1.5 py-1"><Layers size={12} className="text-white" /></div>}
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{ad.brand}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
