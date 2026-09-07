"use client";

import { ImageIcon } from "lucide-react";
import type { NormalizedAd } from "@/lib/types";
import { resolveAdMedia } from "@/lib/media";
import { VideoPreview } from "@/components/video-preview";
import { CarouselPreview } from "@/components/carousel-preview";
import { useEffect, useState } from "react";

export function AdMedia({
  ad,
  variant = "card",
  className = "",
}: {
  ad: NormalizedAd;
  variant?: "card" | "detail";
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const media = resolveAdMedia(ad);
  const type = media.kind;
  const videoUrl = media.videoUrl;
  const imageUrl = media.imageUrl;
  const thumbnailUrl = media.thumbnailUrl;
  const advertiserName = ad.advertiser.displayName || ad.advertiser.name || "Advertiser";

  useEffect(() => {
    setImageFailed(false);
  }, [ad.id]);
  
  const objectFit = "contain";
  
  if (type === "video") {
    const videoSources: string[] = [];
    if (videoUrl) {
      videoSources.push(videoUrl);
    }
    
    if (videoSources.length > 0) {
      return (
        <div className={`h-full w-full bg-zinc-950 flex items-center justify-center relative ${className}`}>
          <VideoPreview
            src={videoSources}
            poster={thumbnailUrl || imageUrl}
            controls={variant === "detail"}
            objectFit={objectFit}
            className="h-full w-full"
          />
        </div>
      );
    }
  }

  if (type === "carousel" && media.carouselAssets && media.carouselAssets.length > 0) {
    return (
      <div className={`h-full w-full bg-zinc-900 flex items-center justify-center relative ${className}`}>
        <CarouselPreview 
          assets={media.carouselAssets} 
          cards={media.cards}
          alt={`Creative from ${advertiserName}`} 
          className="h-full w-full" 
        />
      </div>
    );
  }

  // Fallback to image if it's explicitly an image, OR if video/carousel failed to have valid URLs
  const fallbackImage = imageUrl || thumbnailUrl || (media.carouselAssets?.[0]);
  
  if (fallbackImage && !imageFailed) {
    return (
      <div className={`h-full w-full flex items-center justify-center relative ${variant === 'detail' ? 'bg-zinc-900' : 'bg-zinc-50'} ${className}`}>
        <img
          src={fallbackImage}
          alt={`Creative from ${advertiserName}`}
          className={`h-full w-full text-transparent object-contain`}
          loading="lazy"
          onError={() => {
            setImageFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-50/80 text-muted border-y border-line/50 ${className}`}>
      <div className="grid size-12 place-items-center rounded-full bg-white shadow-sm border border-line">
        <ImageIcon size={20} className="text-zinc-400" />
      </div>
      <p className="text-xs font-medium">Creative unavailable</p>
    </div>
  );
}
