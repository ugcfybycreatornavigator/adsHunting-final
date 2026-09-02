import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { workflowAds } from '@/data/landing/workflowAds';
import { Bookmark, FolderTree, Users } from 'lucide-react';

export function SaveShareSection() {
  const sampleAd = workflowAds[4]; // Svasta Foods (Image)

  return (
    <section className="py-24 md:py-32 bg-white overflow-hidden">
      <LandingContainer className="flex flex-col gap-32">
        
        {/* Swipe Files */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="w-full lg:w-1/2 max-w-[500px]">
            <h2 className="text-[32px] md:text-[40px] font-bold text-text-primary mb-6 leading-[1.1]">
              Stop losing good ads in screenshots.
            </h2>
            <p className="text-[18px] text-text-secondary leading-relaxed">
              Save high-performing creatives directly into organized Swipe Files. Revisit them instantly when you need inspiration for your next brief.
            </p>
          </div>
          <div className="w-full lg:w-1/2 rounded-2xl bg-slate-50 border border-border shadow-[0_20px_50px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(94,169,32,0.04), transparent 70%)' }} />
            
            <div className="noise-texture absolute inset-0 opacity-[0.03]"></div>
            
            <div className="w-[220px] aspect-[4/5] bg-white rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-border overflow-hidden relative mb-[-50px] z-10 hover:-translate-y-2 transition-transform duration-500 rotate-[-2deg]">
              <img src={sampleAd.thumbnail} alt={sampleAd.brand} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex flex-col justify-end">
                <span className="text-white text-[12px] font-bold">{sampleAd.brand}</span>
              </div>
            </div>
            
            <div className="w-full max-w-[340px] bg-white rounded-xl shadow-xl border border-border p-5 z-20 flex flex-col gap-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-[15px] text-text-primary"><Bookmark size={18} className="text-brand fill-brand" /> Save Creative</div>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-text-muted"><FolderTree size={14} /></div>
              </div>
              <div className="h-11 bg-slate-100 border border-border rounded-lg flex items-center px-4 text-[14px] text-text-primary font-medium">
                Q3 CPG Inspiration
              </div>
              <button className="h-11 bg-brand text-white font-bold rounded-lg flex items-center justify-center text-[14px] hover:bg-brand-strong transition-colors">
                Save to Folder
              </button>
            </div>
          </div>
        </div>

        {/* Share Ads (Reverse layout) */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
          <div className="w-full lg:w-1/2 max-w-[500px]">
            <h2 className="text-[32px] md:text-[40px] font-bold text-text-primary mb-6 leading-[1.1]">
              Share the insight, not another screenshot.
            </h2>
            <p className="text-[18px] text-text-secondary leading-relaxed">
              Turn your swipe files into collaborative team intelligence. Generate public links for clients or invite team members to your private workspace.
            </p>
          </div>
          <div className="w-full lg:w-1/2 rounded-2xl bg-slate-50 border border-border shadow-[0_20px_50px_rgba(0,0,0,0.04)] p-8 md:p-12 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(94,169,32,0.04), transparent 70%)' }} />
            <div className="w-full max-w-[400px] mx-auto bg-white rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] border border-border overflow-hidden relative z-10">
               <div className="p-5 border-b border-border bg-white flex items-center gap-3">
                 <div className="w-12 h-12 bg-brand/10 text-brand rounded-xl flex items-center justify-center"><Users size={20} /></div>
                 <div>
                   <div className="font-bold text-[16px] text-text-primary mb-0.5">Share Swipe File</div>
                   <div className="text-[12px] text-text-muted">12 Assets • 3 Members</div>
                 </div>
               </div>
               <div className="p-6 flex flex-col gap-5">
                 <div className="flex gap-2 p-1.5 bg-slate-100 rounded-lg border border-border/50">
                   <div className="flex-1 py-2 text-center text-[13px] font-bold bg-white shadow-sm rounded-md text-text-primary">Public Link</div>
                   <div className="flex-1 py-2 text-center text-[13px] font-bold text-text-secondary">Workspace Only</div>
                 </div>
                 <div className="h-12 bg-slate-100 border border-border rounded-lg flex items-center px-4 text-[13px] font-mono text-text-secondary truncate shadow-inner">
                   adshunting.com/share/q3-cpg...
                 </div>
                 <button className="h-12 bg-text-primary text-white font-bold rounded-lg flex items-center justify-center text-[14px] hover:bg-black transition-colors">
                   Copy Share Link
                 </button>
               </div>
            </div>
          </div>
        </div>

      </LandingContainer>
    </section>
  );
}
