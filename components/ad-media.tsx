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
    
    // Try to get video URL from multiple sources
    let effectiveVideoUrl = videoUrl;
    if (!effectiveVideoUrl && ad.rawData) {
      // Fallback: try to extract from rawData if not in normalized form
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = ad.rawData as any;
      const snap = raw.snapshot || raw;
      effectiveVideoUrl = snap.video_hd_url || snap.video_sd_url || snap.videos?.[0]?.video_hd_url;
    }
    
    if (ad.enrichment?.archiveStatus === "archived" && ad.creative.videoUrl) {
      const ext = ad.creative.videoUrl.includes(".webm") ? "webm" : "mp4";
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ctvmjxpblfdrxvvyjebw.supabase.co";
      videoSources.push(`${supabaseUrl}/storage/v1/object/public/ad-creatives/${ad.provider.discoveryProvider}/${ad.id}/source.${ext}`);
    }
    if (effectiveVideoUrl) {
      videoSources.push(effectiveVideoUrl);
    }
    
    // Get effective poster/thumbnail
    let effectivePoster = thumbnailUrl || imageUrl;
    if (!effectivePoster && ad.rawData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = ad.rawData as any;
      const snap = raw.snapshot || raw;
      effectivePoster = snap.video_preview_image_url || snap.videos?.[0]?.video_preview_image_url;
    }
    
    if (videoSources.length > 0) {
      return (
        <div className={`h-full w-full bg-zinc-950 flex items-center justify-center relative ${className}`}>
          <VideoPreview
            src={videoSources}
            poster={effectivePoster}
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
          alt={`Creative from ${advertiserName}`} 
          className="h-full w-full" 
        />
      </div>
    );
  }

  // Fallback to image if it's explicitly an image, OR if video/carousel failed to have valid URLs
  let fallbackImage = imageUrl || thumbnailUrl || (media.carouselAssets?.[0]);
  
  // Try to get image URL from rawData if not found in normalized form
  if (!fallbackImage && ad.rawData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = ad.rawData as any;
    const snap = raw.snapshot || raw;
    fallbackImage = 
      snap.original_image_url || snap.resized_image_url ||
      snap.image_url || snap.url ||
      snap.images?.[0]?.original_image_url || snap.images?.[0]?.resized_image_url ||
      snap.cards?.[0]?.original_image_url || snap.cards?.[0]?.resized_image_url ||
      snap.thumbnail_url || snap.video_preview_image_url;
  }
  
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
