"use client";

import Link from "next/link";
import { type BrandSummary } from "@/lib/brand-data";
import { ArrowRight } from "lucide-react";
import { safeExternalUrl } from "@/lib/utils";
import { useState } from "react";

function formatPlatformName(platform: string) {
  const map: Record<string, string> = {
    audience_network: "Audience Network",
    facebook: "Facebook",
    facebook_feed: "Facebook",
    instagram: "Instagram",
    instagram_stories: "Instagram",
    messenger: "Messenger",
    threads: "Threads",
  };
  return map[platform] || platform.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatBrandName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const [error, setError] = useState(false);
  const initial = name.slice(0, 1).toUpperCase() || "B";
  const validUrl = safeExternalUrl(url);

  if (validUrl && !error) {
    return (
      <img
        src={validUrl}
        alt={name}
        onError={() => setError(true)}
        className="size-[38px] shrink-0 rounded-[10px] border border-line object-cover bg-zinc-50"
        loading="lazy"
      />
    );
  }

  return (
    <div className="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-zinc-100 border border-line text-xs font-semibold text-zinc-600">
      {initial}
    </div>
  );
}

function CreativePreview({ url }: { url: string }) {
  const [error, setError] = useState(false);
  const validUrl = safeExternalUrl(url);

  if (!validUrl || error) return null;

  return (
    <div className="flex-1 relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden border border-line/50">
      <img
        src={validUrl}
        alt=""
        onError={() => setError(true)}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

export function BrandCard({ brand }: { brand: BrandSummary }) {
  const brandName = formatBrandName(brand.name);
  
  // Clean platforms
  const cleanedPlatforms = Array.from(new Set(brand.platforms.map(formatPlatformName)));
  const displayPlatforms = cleanedPlatforms.slice(0, 3);
  const extraPlatforms = cleanedPlatforms.length > 3 ? cleanedPlatforms.length - 3 : 0;

  // Collect valid creative urls (thumbs or media)
  const previewUrls = [...(brand.previewMedia || []), ...(brand.previewThumbs || [])]
    .map(safeExternalUrl)
    .filter((url): url is string => Boolean(url));
  const uniquePreviews = Array.from(new Set(previewUrls)).slice(0, 3);

  return (
    <Link
      href={`/brands/${encodeURIComponent(brand.id)}`}
      className="group flex flex-col w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white transition-all duration-150 hover:border-[#D1D5DB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      <div className="flex flex-col p-[16px] flex-1">
        {/* Header */}
        <div className="flex items-center gap-[12px]">
          <Avatar url={brand.avatar} name={brandName} />
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="truncate text-[14.5px] font-semibold text-[#18181B] leading-tight">
              {brandName}
            </h3>
            <p className="truncate text-[12.5px] text-[#71717A] mt-[2px]">
              Advertiser
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-[16px] mt-[14px] mb-[16px]">
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[14px] font-semibold text-[#18181B]">
              {brand.activeUnique != null ? brand.activeUnique : "—"}
            </span>
            <span className="text-[12.5px] text-[#71717A]">Active</span>
          </div>
          <div className="flex items-baseline gap-[4px]">
            <span className="text-[14px] font-semibold text-[#18181B]">
              {brand.totalUnique != null ? brand.totalUnique : "—"}
            </span>
            <span className="text-[12.5px] text-[#71717A]">Ads</span>
          </div>
        </div>

        {/* Creatives Preview */}
        <div className="flex gap-[6px] mb-[16px]">
          {uniquePreviews.length > 0 ? (
            uniquePreviews.map((url, i) => (
              <CreativePreview key={i} url={url} />
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center aspect-[21/9] bg-[#F4F4F5] rounded-lg border border-[#E5E7EB] text-[12px] text-[#A1A1AA]">
              No preview
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-[4px] flex items-center justify-between border-t border-transparent">
          <p className="truncate text-[12.5px] text-[#71717A] flex-1 pr-[8px]">
            {displayPlatforms.length > 0 ? (
              <>
                {displayPlatforms.join(" · ")}
                {extraPlatforms > 0 && ` · +${extraPlatforms}`}
              </>
            ) : (
              "Cross Platform"
            )}
          </p>
          <div className="flex items-center gap-[4px] text-[12.5px] font-medium text-[#18181B] opacity-80 transition-all duration-150 group-hover:opacity-100">
            View Brand <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-[2px]" />
          </div>
        </div>
      </div>
    </Link>
  );
}
