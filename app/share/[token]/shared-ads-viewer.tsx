"use client";

import { useState } from "react";
import type { NormalizedAd } from "@/lib/types";
import { SharedCreativeView } from "@/components/shared-creative-view";
import { AdDetailDrawer } from "@/components/ad-detail";

export function SharedAdsViewer({ ads, isPrivate }: { ads: NormalizedAd[]; isPrivate: boolean }) {
  const [selectedAd, setSelectedAd] = useState<NormalizedAd | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {ads.map((ad) => (
        <SharedCreativeView 
          key={ad.id} 
          ad={ad} 
          onOpen={() => setSelectedAd(ad)} 
        />
      ))}
      
      {selectedAd && (
        <AdDetailDrawer 
          ad={selectedAd} 
          onClose={() => setSelectedAd(null)}
          isPublicShare={!isPrivate}
        />
      )}
    </div>
  );
}
