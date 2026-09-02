'use client';

import React, { useState } from 'react';
import { Globe2, Lock, Copy, Link2Off, Check } from 'lucide-react';

export function ShareDemo() {
  const [accessMode, setAccessMode] = useState<'public' | 'private'>('public');
  const [linkCreated, setLinkCreated] = useState(false);

  const handleCreateLink = () => {
    setLinkCreated(true);
    setTimeout(() => {
      setLinkCreated(false);
    }, 3000); // Reset for demo purposes
  };

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col gap-4 md:gap-6">
      {/* Create Share Link Panel */}
      <div className="bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] p-6 shadow-sm overflow-hidden text-left relative">
        <h4 className="text-[13px] font-bold text-text-muted uppercase tracking-widest mb-6">Share Ad</h4>
        
        <div className="mb-4">
          <label className="block text-[14px] font-semibold text-text-primary mb-3">Access</label>
          <div className="flex bg-[#fcfcfa] border border-[#e4e8e2] p-1 rounded-[12px]">
            <button
              onClick={() => setAccessMode('public')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[8px] text-[14px] font-medium transition-all duration-200 ${
                accessMode === 'public' 
                  ? 'bg-[#eef4ec] text-brand border border-[#d2dfcb]' 
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              <Globe2 size={16} /> Public
            </button>
            <button
              onClick={() => setAccessMode('private')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[8px] text-[14px] font-medium transition-all duration-200 ${
                accessMode === 'private' 
                  ? 'bg-[#f4f5f3] text-text-primary border border-[#e4e8e2]' 
                  : 'text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              <Lock size={16} /> Private
            </button>
          </div>
        </div>

        <div className="h-[72px] flex items-center transition-opacity duration-200">
          {accessMode === 'public' ? (
            <div className="text-[14px] text-text-secondary leading-relaxed">
              <strong className="text-text-primary block mb-1">Public link</strong>
              Create a shareable link using AdsHunting&apos;s public sharing flow.
            </div>
          ) : (
            <div className="text-[14px] text-text-secondary leading-relaxed">
              <strong className="text-text-primary block mb-1">Private link</strong>
              Viewers must sign in before accessing a private shared ad.
            </div>
          )}
        </div>

        <div className="mt-6">
          {!linkCreated ? (
            <button 
              onClick={handleCreateLink}
              className="w-full py-3 bg-brand text-white font-bold rounded-xl text-[15px] hover:bg-brand-hover transition-colors"
            >
              Create Share Link
            </button>
          ) : (
            <div className="w-full py-3 bg-[#f2f6f0] border border-[#d2dfcb] rounded-xl flex items-center justify-between px-4">
              <span className="text-[14px] text-text-secondary font-mono truncate mr-3">adshunting.../shared/...</span>
              <button className="text-brand font-bold text-[14px] shrink-0 flex items-center gap-2">
                <Check size={16} /> Copied
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center text-border-strong hidden md:flex">
        <div className="h-6 w-px bg-[#e4e8e2]"></div>
      </div>

      {/* Shared Links Management Panel */}
      <div className="bg-[#ffffff] border border-[#e4e8e2] rounded-[20px] p-6 shadow-sm text-left">
        <h4 className="text-[13px] font-bold text-text-muted uppercase tracking-widest mb-6">Shared Links</h4>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-[#e4e8e2] rounded-[16px] bg-[#fcfcfa]">
          <div className="min-w-0 flex-1">
            <h5 className="font-semibold text-text-primary text-[15px] truncate mb-1.5">Nike — Winter Campaign</h5>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[#f2f6f0] text-brand text-[11px] font-bold uppercase tracking-widest">
                Private
              </span>
              <span className="text-[13px] text-text-muted">Active</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button className="p-2 text-text-secondary hover:text-brand hover:bg-[#f2f6f0] rounded-lg transition-colors" aria-label="Copy Link">
              <Copy size={18} />
            </button>
            <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-[#f4f5f3] rounded-lg transition-colors" aria-label="Disable Link">
              <Link2Off size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
