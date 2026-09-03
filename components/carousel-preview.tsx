"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { safeExternalUrl } from "@/lib/utils";

export function CarouselPreview({ assets, alt, className = "" }: { assets: string[]; alt: string; className?: string }) {
  const safeAssets = assets.map(safeExternalUrl).filter((asset): asset is string => Boolean(asset));
  const [index, setIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  
  const current = safeAssets[index];
  
  const move = (event: React.MouseEvent, direction: number) => {
    event.stopPropagation();
    event.preventDefault();
    setIndex((value) => (value + direction + safeAssets.length) % safeAssets.length);
  };
  
  if (!current) return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-50/80 text-muted ${className}`}>
        <div className="grid size-12 place-items-center rounded-full bg-white shadow-sm border border-line">
          <ImageIcon size={20} className="text-zinc-400" />
        </div>
        <p className="text-xs font-medium">Creative unavailable</p>
      </div>
  );
  
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      {failedIndices.has(index) ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-50/80 text-muted">
          <div className="grid size-12 place-items-center rounded-full bg-white shadow-sm border border-line">
            <ImageIcon size={20} className="text-zinc-400" />
          </div>
          <p className="text-xs font-medium">Item unavailable</p>
        </div>
      ) : (
        <img 
          key={current} 
          src={current} 
          alt={`${alt}, item ${index + 1} of ${safeAssets.length}`} 
          loading="lazy" 
          onError={() => setFailedIndices(prev => new Set(prev).add(index))}
          className="h-full w-full object-contain text-transparent" 
        />
      )}
      {safeAssets.length > 1 && <>
        {index > 0 && (
          <button type="button" onClick={(event) => move(event, -1)} aria-label="Previous carousel item" className="absolute left-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white transition"><ChevronLeft size={16} /></button>
        )}
        {index < safeAssets.length - 1 && (
          <button type="button" onClick={(event) => move(event, 1)} aria-label="Next carousel item" className="absolute right-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white transition"><ChevronRight size={16} /></button>
        )}
        <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white border border-white/10 shadow-sm">{index + 1} / {safeAssets.length}</span>
      </>}
    </div>
  );
}
