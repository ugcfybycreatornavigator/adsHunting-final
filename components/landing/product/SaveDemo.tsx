'use client';

import React, { useState } from 'react';
import { demoAds } from '@/data/landing/demoAds';
import { Bookmark, FolderOpen, Check, FolderPlus, ChevronRight } from 'lucide-react';

export function SaveDemo() {
  const ad = demoAds[0];
  const [saveState, setSaveState] = useState<'idle' | 'picking' | 'saved'>('idle');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const handleFolderSelect = (folderName: string) => {
    setSelectedFolder(folderName);
    setSaveState('saved');
    
    // Reset after a moment to keep the demo loop alive if desired, 
    // or just leave it for the user to interact with again
    setTimeout(() => {
      setSaveState('idle');
      setSelectedFolder(null);
    }, 4000);
  };

  return (
    <div className="w-full max-w-[500px] mx-auto bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] shadow-sm overflow-hidden h-[420px] flex flex-col relative">
      
      {/* Background ad (simulated context) */}
      <div className="p-6 pb-0 flex justify-center opacity-40 grayscale pointer-events-none absolute inset-0 -top-12 z-0 scale-[1.1]">
         <div className="w-3/4 max-w-[320px] bg-white border border-[#e4e8e2] rounded-xl overflow-hidden shadow-lg">
            { }
            <img src={ad.thumbnail} className="w-full aspect-[4/5] object-cover" alt="" />
         </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/80 to-white z-0"></div>

      {/* Interactive Save Flow Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 p-6">
        
        {saveState === 'idle' && (
          <div className="animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setSaveState('picking')}
              className="group flex flex-col items-center gap-3 bg-white border border-[#e4e8e2] rounded-[24px] p-8 shadow-md hover:shadow-lg hover:border-[#d2dfcb] transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-[#fcfcfa] flex items-center justify-center border border-[#e4e8e2] group-hover:bg-[#f2f6f0] group-hover:border-[#d2dfcb] transition-colors">
                <Bookmark size={28} className="text-text-secondary group-hover:text-brand transition-colors" />
              </div>
              <span className="text-[16px] font-bold text-text-primary">Save Creative</span>
            </button>
          </div>
        )}

        {saveState === 'picking' && (
          <div className="w-full max-w-[340px] bg-white border border-[#e4e8e2] rounded-[20px] shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="px-5 py-4 border-b border-[#e4e8e2] bg-[#fcfcfa]">
              <h4 className="text-[14px] font-bold text-text-primary">Choose Swipe File</h4>
            </div>
            <div className="p-2 space-y-1">
              <button onClick={() => handleFolderSelect('Saved Ads')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9faf8] rounded-[10px] transition-colors text-left group">
                <FolderOpen size={16} className="text-text-muted group-hover:text-brand" />
                <span className="flex-1 text-[14px] font-medium text-text-primary">Saved Ads <span className="text-text-muted text-[12px] font-normal ml-1">(Default)</span></span>
                <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100" />
              </button>
              <button onClick={() => handleFolderSelect('Competitors')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9faf8] rounded-[10px] transition-colors text-left group">
                <FolderOpen size={16} className="text-text-muted group-hover:text-brand" />
                <span className="flex-1 text-[14px] font-medium text-text-primary">Competitors</span>
                <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100" />
              </button>
              <button onClick={() => handleFolderSelect('Hooks & Angles')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9faf8] rounded-[10px] transition-colors text-left group">
                <FolderOpen size={16} className="text-text-muted group-hover:text-brand" />
                <span className="flex-1 text-[14px] font-medium text-text-primary">Hooks & Angles</span>
                <ChevronRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100" />
              </button>
            </div>
            <div className="p-3 border-t border-[#e4e8e2] bg-[#fcfcfa]">
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-[#e4e8e2] hover:bg-[#f2f6f0] hover:text-brand hover:border-[#d2dfcb] rounded-[10px] transition-all text-[13px] font-bold text-text-secondary">
                <FolderPlus size={14} /> New Swipe File
              </button>
            </div>
          </div>
        )}

        {saveState === 'saved' && (
          <div className="w-full max-w-[340px] bg-[#eef4ec] border border-[#d2dfcb] rounded-[20px] p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-[#10b981] mx-auto flex items-center justify-center text-white mb-4 shadow-sm">
              <Check size={24} />
            </div>
            <h4 className="text-[18px] font-bold text-text-primary mb-2">Saved successfully</h4>
            <p className="text-[14px] text-text-secondary">
              Added to <strong className="text-text-primary">{selectedFolder}</strong>
            </p>
          </div>
        )}

      </div>

      {/* Swipe Files Count Panel (Decorative context) */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="bg-white/80 backdrop-blur-sm border border-[#e4e8e2] rounded-[16px] p-4 flex items-center justify-between shadow-sm">
           <div className="text-[12px] font-bold uppercase tracking-widest text-text-muted">Swipe Files Overview</div>
           <div className="flex gap-4">
             <div className="text-center">
               <div className="text-[16px] font-bold text-text-primary">24</div>
               <div className="text-[11px] text-text-secondary">Saved Ads</div>
             </div>
             <div className="text-center">
               <div className="text-[16px] font-bold text-text-primary">12</div>
               <div className="text-[11px] text-text-secondary">Competitors</div>
             </div>
           </div>
        </div>
      </div>
      
    </div>
  );
}
