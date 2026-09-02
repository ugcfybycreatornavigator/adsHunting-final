'use client';

import React, { useState } from 'react';
import { demoAds } from '@/data/landing/demoAds';
import { Video, Image as ImageIcon, Layers, Search, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ResearchDemo() {
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');
  
  const filteredAds = demoAds.filter(ad => {
    if (ad.brand !== 'Frido') return false;
    if (filter === 'all') return true;
    return ad.format === filter;
  });

  return (
    <div className="w-full max-w-[580px] mx-auto bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] shadow-sm overflow-hidden flex flex-col h-[440px]">
      
      {/* Header: Brand context */}
      <div className="p-5 md:p-6 border-b border-[#e4e8e2] bg-[#fcfcfa] shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-[12px] bg-[#f2f6f0] border border-[#d2dfcb] flex items-center justify-center text-[20px] font-bold text-brand">
            F
          </div>
          <div>
            <h3 className="text-[18px] font-bold text-text-primary">Frido</h3>
            <span className="text-[13px] text-text-secondary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span> 14 Active Creatives
            </span>
          </div>
        </div>
        
        {/* Research dimensions strip */}
        <div className="flex items-start sm:items-center gap-2 text-[12px] md:text-[13px] font-medium text-text-muted bg-[#ffffff] border border-[#e4e8e2] rounded-[8px] px-3 py-2">
          <Eye size={14} className="shrink-0 mt-0.5 sm:mt-0" />
          <span className="text-text-secondary leading-snug">
            Observe: Formats • Messaging • Creative repetition • Runtime
          </span>
        </div>
      </div>

      {/* Creative Library */}
      <div className="flex-1 p-5 md:p-6 flex flex-col overflow-hidden">
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-5 shrink-0 overflow-x-auto hide-scrollbar pb-1">
          <button 
            onClick={() => setFilter('all')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors whitespace-nowrap",
              filter === 'all' ? "bg-[#eef4ec] text-brand border border-[#d2dfcb]" : "bg-[#fcfcfa] text-text-secondary border border-[#e4e8e2] hover:text-text-primary"
            )}
          >
            All Creatives
          </button>
          <button 
            onClick={() => setFilter('video')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
              filter === 'video' ? "bg-[#eef4ec] text-brand border border-[#d2dfcb]" : "bg-[#fcfcfa] text-text-secondary border border-[#e4e8e2] hover:text-text-primary"
            )}
          >
            <Video size={14} /> Video
          </button>
          <button 
            onClick={() => setFilter('image')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors whitespace-nowrap flex items-center gap-1.5",
              filter === 'image' ? "bg-[#eef4ec] text-brand border border-[#d2dfcb]" : "bg-[#fcfcfa] text-text-secondary border border-[#e4e8e2] hover:text-text-primary"
            )}
          >
            <ImageIcon size={14} /> Image
          </button>
        </div>

        {/* Creatives Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 transition-opacity duration-200">
            {filteredAds.length > 0 ? filteredAds.map((ad, idx) => (
              <div key={`${ad.id}-${idx}`} className="group relative rounded-xl overflow-hidden border border-[#e4e8e2] bg-[#fcfcfa] aspect-square">
                { }
                <img src={ad.thumbnail} alt="Creative preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                
                {/* Format Icon */}
                <div className="absolute top-2 right-2">
                   {ad.format === 'video' && <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5"><Video size={12} className="text-white" /></div>}
                   {ad.format === 'image' && <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5"><ImageIcon size={12} className="text-white" /></div>}
                   {ad.format === 'carousel' && <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5"><Layers size={12} className="text-white" /></div>}
                </div>

                <div className="absolute bottom-2 left-2 right-2">
                  <span className="text-[11px] font-medium text-white/90 truncate block drop-shadow-md">
                    {ad.startedAt}
                  </span>
                </div>
              </div>
            )) : (
              <div className="col-span-2 flex flex-col items-center justify-center py-8 text-text-muted">
                <Search size={24} className="mb-2 opacity-50" />
                <span className="text-[14px]">No {filter} creatives found</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
