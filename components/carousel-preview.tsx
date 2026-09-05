"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { safeExternalUrl } from "@/lib/utils";

export function CarouselPreview({ assets, alt, className = "" }: { assets: string[]; alt: string; className?: string }) {
  const safeAssets = useMemo(() => assets.map(safeExternalUrl).filter((asset): asset is string => Boolean(asset)), [assets]);
  const [index, setIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  
  const availableAssets = safeAssets.filter((_, assetIndex) => !failedIndices.has(assetIndex));
  const current = availableAssets[index % Math.max(availableAssets.length, 1)];

  useEffect(() => {
    setIndex(0);
    setFailedIndices(new Set());
  }, [safeAssets]);
  
  const move = (event: React.MouseEvent, direction: number) => {
    event.stopPropagation();
    event.preventDefault();
    setIndex((value) => (value + direction + availableAssets.length) % availableAssets.length);
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
      <img
        key={current}
        src={current}
        alt={`${alt}, item ${Math.min(index + 1, availableAssets.length)} of ${availableAssets.length}`}
        loading="lazy"
        onError={() => {
          const failedIndex = safeAssets.indexOf(current);
          setFailedIndices(prev => new Set(prev).add(failedIndex));
          setIndex(0);
        }}
        className="h-full w-full object-contain text-transparent"
      />
      {availableAssets.length > 1 && <>
        {index > 0 && (
          <button type="button" onClick={(event) => move(event, -1)} aria-label="Previous carousel item" className="absolute left-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white transition"><ChevronLeft size={16} /></button>
        )}
        {index < availableAssets.length - 1 && (
          <button type="button" onClick={(event) => move(event, 1)} aria-label="Next carousel item" className="absolute right-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white transition"><ChevronRight size={16} /></button>
        )}
        <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white border border-white/10 shadow-sm">{Math.min(index + 1, availableAssets.length)} / {availableAssets.length}</span>
      </>}
    </div>
  );
}
