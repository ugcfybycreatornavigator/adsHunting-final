"use client";

import { useState } from "react";
import type { NormalizedAd } from "@/lib/types";
import { SharedCreativeView } from "@/components/shared-creative-view";
import { AdDetailDrawer } from "@/components/ad-detail";
import { useRouter } from "next/navigation";

export function SharedAdsViewer({ ads, allowSave, allowDownload }: { ads: NormalizedAd[]; allowSave: boolean; allowDownload: boolean }) {
  const [selectedAd, setSelectedAd] = useState<NormalizedAd | null>(null);
  const router = useRouter();

  async function saveSharedAd(ad: NormalizedAd) {
    const response = await fetch("/api/swipe-files/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: ad.id, externalAdId: ad.externalId || ad.id }),
    });
    if (response.status === 401) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`);
      throw new Error("Sign in to save this ad.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Couldn't save this ad.");
  }

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
          isPublicShare
          allowSharedSave={allowSave}
          allowSharedDownload={allowDownload}
          onSave={() => saveSharedAd(selectedAd)}
        />
      )}
    </div>
  );
}
