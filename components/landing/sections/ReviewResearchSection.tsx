import React from 'react';
import { LandingContainer } from '../layout/LandingContainer';
import { workflowAds } from '@/data/landing/workflowAds';
import { Heart, Share } from 'lucide-react';

export function ReviewResearchSection() {
  const sampleAd1 = workflowAds[2]; // Aura Sound (Image)


  return (
    <section className="py-24 md:py-32 bg-slate-50 border-t border-border overflow-hidden relative">
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(94,169,32,0.04), transparent 70%)'
        }}
      />
      <LandingContainer className="flex flex-col gap-32 relative z-10">
        
        {/* Review Section */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="w-full lg:w-[55%] rounded-2xl bg-white border border-border shadow-[0_20px_50px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col sm:flex-row h-auto sm:h-[420px]">
            <div className="w-full sm:w-[45%] h-[300px] sm:h-full relative overflow-hidden bg-black">
              <img src={sampleAd1.thumbnail} alt={sampleAd1.brand} className="w-full h-full object-cover opacity-80 blur-[20px] absolute inset-0 scale-110" />
              <div className="absolute inset-4 sm:inset-6 bg-black rounded-lg overflow-hidden shadow-2xl border border-white/10">
                 <img src={sampleAd1.thumbnail} alt={sampleAd1.brand} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="w-full sm:w-[55%] p-6 md:p-8 flex flex-col bg-slate-50 border-l border-border overflow-y-auto">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-xl bg-slate-100 border border-border flex items-center justify-center font-bold text-text-primary shadow-sm">{sampleAd1.brand.charAt(0)}</div>
                 <div>
                   <h3 className="font-bold text-[18px] text-text-primary leading-none mb-1">{sampleAd1.brand}</h3>
                   <span className="text-[12px] text-text-muted">Active Ad • Format: Image</span>
                 </div>
               </div>
               
               <div className="bg-slate-100 p-4 rounded-xl border border-border mb-6">
                 <p className="text-[14px] text-text-primary leading-relaxed">
                   {sampleAd1.primaryText}
                 </p>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-auto">
                 <div className="bg-white p-3 border border-border rounded-lg shadow-sm">
                   <div className="text-[11px] font-bold text-text-muted uppercase mb-1">Fatigue</div>
                   <div className="text-[14px] font-bold text-text-primary">{sampleAd1.signals?.creativeFatigue}</div>
                 </div>
                 <div className="bg-white p-3 border border-border rounded-lg shadow-sm">
                   <div className="text-[11px] font-bold text-text-muted uppercase mb-1">Scaling</div>
                   <div className="text-[14px] font-bold text-text-primary">{sampleAd1.signals?.scaling}</div>
                 </div>
               </div>

               <div className="pt-6 flex gap-3 mt-4">
                 <button className="flex-1 h-10 bg-brand text-white rounded-lg font-medium text-[14px] hover:bg-brand-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                   <Heart size={16} /> Save
                 </button>
                 <button className="w-10 h-10 bg-white border border-border text-text-primary rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors shadow-sm">
                   <Share size={16} />
                 </button>
               </div>
            </div>
          </div>
          <div className="w-full lg:w-[45%] max-w-[500px]">
            <h2 className="text-[32px] md:text-[40px] font-bold text-text-primary mb-6 leading-[1.1]">
              Understand the creative before copying the idea.
            </h2>
            <p className="text-[18px] text-text-secondary leading-relaxed">
              Every ad has a strategy. Review the full creative, read the original caption, check the active status, and see exactly when it started running.
            </p>
          </div>
        </div>



      </LandingContainer>
    </section>
  );
}
