"use client";

import type { NormalizedAd } from "@/lib/types";
import { resolveAdMedia } from "@/lib/media";
import { VideoPreview } from "@/components/video-preview";
import { CarouselPreview } from "@/components/carousel-preview";
import { useEffect, useMemo, useState } from "react";

export function AdMedia({
  ad,
  variant = "card",
  className = "",
  priority = false,
  onMediaError,
}: {
  ad: NormalizedAd;
  variant?: "card" | "detail";
  className?: string;
  priority?: boolean;
  onMediaError?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const media = useMemo(() => resolveAdMedia(ad), [ad]);
  const type = media.kind;
  const videoUrl = media.videoUrl;
  const imageUrl = media.imageUrl;
  const thumbnailUrl = media.thumbnailUrl;
  const advertiserName = ad.advertiser.displayName || ad.advertiser.name || "Advertiser";
  const fallbackCopy = ad.copy.headline || ad.copy.primaryText || ad.copy.description;

  useEffect(() => {
    setImageFailed(false);
  }, [ad.id]);

  useEffect(() => {
    if (type === "unknown") {
      onMediaError?.();
    }
  }, [type, onMediaError]);
  
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
          className="h-full w-full text-transparent object-contain"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => {
            setImageFailed(true);
            onMediaError?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full flex-col justify-between border-y border-line/60 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 shadow-sm">
          Text ad
        </span>
        {ad.destination?.domain && (
          <span className="truncate text-[10px] font-medium text-zinc-400">
            {ad.destination.domain}
          </span>
        )}
      </div>
      <p className="line-clamp-4 text-xs font-medium leading-relaxed text-zinc-700">
        &ldquo;{fallbackCopy || `Advertisement from ${advertiserName}`}&rdquo;
      </p>
      <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] text-zinc-400">
        <span className="truncate font-medium">{advertiserName}</span>
        <span className="shrink-0 text-zinc-400">Verified copy</span>
      </div>
    </div>
  );
}
