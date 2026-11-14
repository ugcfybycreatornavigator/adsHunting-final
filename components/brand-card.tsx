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

function CreativePreview({ url, brandName }: { url: string; brandName?: string }) {
  const [error, setError] = useState(false);
  const validUrl = safeExternalUrl(url);

  if (!validUrl || error) return null;

  return (
    <div className="flex-1 relative aspect-[4/5] bg-zinc-100 rounded-lg overflow-hidden border border-line/50">
      <img
        src={validUrl}
        alt={`${brandName || "Brand"} creative preview`}
        onError={() => setError(true)}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

export function BrandCard({ brand, layout = "grid" }: { brand: BrandSummary; layout?: "grid" | "list" }) {
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
      href={`/competitors/${encodeURIComponent(brand.id)}?name=${encodeURIComponent(brandName)}`}
      className={`group flex w-full flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white transition-all duration-150 hover:border-[#D1D5DB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${layout === "list" ? "md:min-h-[160px]" : ""}`}
    >
      <div className={`flex flex-1 flex-col p-[16px] ${layout === "list" ? "md:grid md:grid-cols-[minmax(220px,1fr)_240px_minmax(200px,1fr)] md:grid-rows-[auto_1fr] md:items-center md:gap-x-6" : ""}`}>
        {/* Header */}
        <div className={layout === "list" ? "flex items-center gap-[12px] md:col-start-1 md:row-start-1" : "flex items-center gap-[12px]"}>
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
        <div className={`flex items-center gap-[16px] mt-[14px] mb-[16px] ${layout === "list" ? "md:col-start-1 md:row-start-2 md:mb-0" : ""}`}>
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
        <div className={`flex gap-[6px] mb-[16px] ${layout === "list" ? "md:col-start-2 md:row-span-2 md:row-start-1 md:mb-0" : ""}`}>
          {uniquePreviews.length > 0 ? (
            uniquePreviews.map((url, i) => (
              <CreativePreview key={i} url={url} brandName={brandName} />
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center aspect-[21/9] bg-[#F4F4F5] rounded-lg border border-[#E5E7EB] text-[12px] text-[#A1A1AA]">
              No preview
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`mt-auto flex items-center justify-between border-t border-transparent pt-[4px] ${layout === "list" ? "md:col-start-3 md:row-span-2 md:row-start-1" : ""}`}>
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
