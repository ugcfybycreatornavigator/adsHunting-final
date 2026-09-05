"use client";

import { ImageIcon, PlaySquare, Images } from "lucide-react";
import type { NormalizedAd } from "@/lib/types";
import { formatDuration, sanitizeAdCopy, cn } from "@/lib/utils";
import { AdMedia } from "@/components/ad-media";
import { Badge } from "@/components/ui";

function signalLabel(label: string | undefined | null, ad: NormalizedAd) {
  if (!label) return "Unknown";
  if (label === "High-Confidence Winner") return "Exceptional";
  if (label === "Proven Long Runner") return "Long Runner";
  if (label === "Emerging Winner") return "Promising";
  if (label === "Standard") return (ad.intelligence.winnerScore ?? 0) >= 70 ? "Strong Signal" : (ad.intelligence.winnerScore ?? 0) >= 55 ? "Promising" : "Testing";
  if (label === "Testing") return "Testing";
  return label.replace(/\(.+\)/, "").trim() || "Unknown";
}

function titleCase(value: string) {
  if (!value) return "";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

import { resolveAdMedia } from "@/lib/media";

export function SharedCreativeView({ ad, onOpen }: { ad: NormalizedAd; onOpen?: () => void }) {
  const media = resolveAdMedia(ad);
  const advertiserName = ad.advertiser.displayName || ad.advertiser.name || "Advertiser";
  const initial = advertiserName.slice(0, 1).toUpperCase() || "A";

  const displayCopy =
    sanitizeAdCopy(ad.copy.headline) ||
    sanitizeAdCopy(ad.copy.primaryText) ||
    sanitizeAdCopy(ad.copy.description);

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[16px] border border-line bg-white shadow-sm md:flex-row w-full max-w-5xl mx-auto transition-shadow hover:shadow-md">
      {onOpen && (
        <div 
          className="absolute inset-0 z-0 cursor-pointer" 
          onClick={onOpen} 
          role="button" 
          tabIndex={0} 
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()} 
          aria-label={`Open ad by ${advertiserName}`}
        />
      )}
      
      {/* 60% Media Section */}
      <div className="relative z-10 w-full md:w-[55%] lg:w-[60%] shrink-0 bg-zinc-50 border-b md:border-b-0 md:border-r border-line aspect-square md:aspect-auto pointer-events-none">
        <div className="absolute inset-0 pointer-events-auto">
           <AdMedia ad={ad} variant="detail" />
        </div>
      </div>

      {/* 40% Information Section */}
      <div className="relative z-10 flex w-full md:w-[45%] lg:w-[40%] flex-col p-5 md:p-6 lg:p-8 pointer-events-none">
        <div className="flex items-center gap-3">
          {ad.advertiser.logoUrl ? (
            <img 
              src={ad.advertiser.logoUrl} 
              alt="" 
              className="size-10 shrink-0 rounded-full border border-line object-cover bg-zinc-50" 
              loading="lazy"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black text-xs font-bold text-white">{initial}</span>
          )}
          <div className="flex flex-col min-w-0">
            <span className="truncate text-base font-semibold text-ink">
              {advertiserName}
            </span>
            <span className="truncate text-xs font-medium text-muted">
               {(Array.isArray(ad.delivery.platforms) ? ad.delivery.platforms : []).map(titleCase).join(" + ") || "Unknown Platform"}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <Badge tone={ad.delivery.status === "active" ? "red" : "dark"} className="px-2 py-1 text-[11px] shadow-sm uppercase font-semibold tracking-wide">
            {ad.delivery.status || "Unknown"}
          </Badge>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-600 capitalize">
            {media.kind === "video" ? <PlaySquare size={13} /> : media.kind === "carousel" ? <Images size={13} /> : <ImageIcon size={13} />}
            {media.kind || "Unknown"}
          </span>
          {ad.delivery.daysRunning != null && (
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-600">
              {formatDuration(ad.delivery.daysRunning)}
            </span>
          )}
        </div>

        <div className="mt-6 flex-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Ad Copy</h4>
          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto pr-2 custom-scrollbar", displayCopy ? "text-ink" : "text-muted italic")}>
            {displayCopy || "No copy available"}
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-line">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">AdsHunting Signals (Estimated)</h4>
          <div className="grid grid-cols-2 gap-3">
             <div className="rounded-lg bg-zinc-50 border border-line p-3">
                <div className="text-[10px] font-semibold text-muted uppercase">Winner Score</div>
                <div className="mt-1 text-xl font-bold text-ink">
                  {ad.intelligence?.winnerScore != null ? (
                    <>{Math.round(ad.intelligence.winnerScore)}<span className="text-sm font-medium text-muted">/100</span></>
                  ) : (
                    <span className="text-sm font-medium">Not enough data</span>
                  )}
                </div>
             </div>
             <div className="rounded-lg bg-zinc-50 border border-line p-3">
                <div className="text-[10px] font-semibold text-muted uppercase">Signal</div>
                <div className="mt-1 text-sm font-bold text-signal truncate">
                  {Array.isArray(ad.intelligence?.labels) && ad.intelligence!.labels.length > 0
                    ? signalLabel(ad.intelligence!.labels[0], ad)
                    : "Not enough data"}
                </div>
             </div>
          </div>
        </div>
      </div>
    </article>
  );
}
