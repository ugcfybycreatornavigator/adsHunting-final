'use client';

import React from 'react';
import { demoAds } from '@/data/landing/demoAds';
import { Play, ExternalLink } from 'lucide-react';

export function ReviewDemo() {
  const ad = demoAds[0]; // Frido video ad

  return (
    <div className="w-full max-w-[560px] mx-auto bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] shadow-sm overflow-hidden flex flex-col sm:flex-row h-auto sm:h-[380px]">
      
      {/* Left side: Ad Preview */}
      <div className="sm:w-1/2 bg-[#fcfcfa] border-b sm:border-b-0 sm:border-r border-[#e4e8e2] relative group">
        { }
        <img 
          src={ad.thumbnail} 
          alt="Ad creative" 
          className="w-full h-full object-cover aspect-[4/5] sm:aspect-auto"
        />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
            <Play size={20} className="text-text-primary ml-1" />
          </div>
        </div>
      </div>

      {/* Right side: Ad Details */}
      <div className="sm:w-1/2 p-5 md:p-6 flex flex-col text-left bg-white">
        <h4 className="text-[13px] font-bold text-text-muted uppercase tracking-widest mb-6">Ad Details</h4>
        
        <div className="flex-1 space-y-5">
          <div>
            <span className="block text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wide">Advertiser</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#f2f6f0] flex items-center justify-center text-[10px] font-bold text-brand border border-[#d2dfcb]">F</div>
              <span className="text-[15px] font-bold text-text-primary">{ad.brand}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[12px] font-medium text-text-muted mb-1.5 uppercase tracking-wide">Status</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[#eef4ec] border border-[#d2dfcb] text-brand text-[12px] font-bold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>Active
              </span>
            </div>
            <div>
              <span className="block text-[12px] font-medium text-text-muted mb-1.5 uppercase tracking-wide">Format</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#fcfcfa] border border-[#e4e8e2] text-text-secondary text-[12px] font-medium capitalize">
                {ad.format}
              </span>
            </div>
          </div>

          <div>
            <span className="block text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wide">Started Running</span>
            <span className="text-[14px] text-text-primary">Aug 10, 2026</span>
          </div>

          <div>
            <span className="block text-[12px] font-medium text-text-muted mb-1 uppercase tracking-wide">Primary Text</span>
            <p className="text-[14px] text-text-secondary leading-snug line-clamp-2">
              {ad.primaryText}
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#e4e8e2]">
          <button className="flex items-center gap-2 text-[14px] font-semibold text-text-secondary hover:text-brand transition-colors">
            <ExternalLink size={16} /> View Destination
          </button>
        </div>

      </div>
    </div>
  );
}
