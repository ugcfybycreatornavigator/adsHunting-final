"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Bookmark, Check, ExternalLink, ImageIcon, Info, Loader2, 
  Copy, ArrowRight, Globe, Share, LayoutTemplate, X, Download, 
  MoreHorizontal
} from "lucide-react";
import { AdMedia } from "@/components/ad-media";
import { SwipeFilePicker } from "@/components/swipe-file-picker";
import { ShareModal } from "@/components/share-modal";
import type { NormalizedAd } from "@/lib/types";
import { resolveAdMedia } from "@/lib/media";
import { cn, formatDate, safeExternalUrl, sanitizeAdCopy } from "@/lib/utils";

// --------------------------------------------------------------------------------
// Data Normalization Helpers
// --------------------------------------------------------------------------------

function titleCase(value: string) { 
  return value.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()); 
}

function cleanUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function normalizePlatform(p: string) {
  const lowered = p.toLowerCase();
  if (lowered === "facebook" || lowered === "fb") return "Facebook";
  if (lowered === "instagram" || lowered === "ig") return "Instagram";
  if (lowered === "messenger") return "Messenger";
  if (lowered === "audience_network") return "Audience Network";
  if (lowered === "threads") return "Threads";
  return titleCase(p);
}

// normalizePlacement removed (unused)

function getScoreTheme(rawScore: number) {
  const score = Math.max(0, Math.min(100, isNaN(rawScore) ? 0 : rawScore));
  if (score < 50) {
    return {
      text: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      bar: "bg-red-500",
      label: score < 30 ? "Very Low" : "Low Potential"
    };
  }
  return {
    text: "text-brand",
    bg: "bg-brand",
    border: "border-brand",
    bar: "bg-brand",
    label: score >= 85 ? "Excellent Potential" : score >= 70 ? "Strong Potential" : "Moderate Potential"
  };
}

// --------------------------------------------------------------------------------
// Popover Primitive
// --------------------------------------------------------------------------------

function MetadataPopover({ 
  children, 
  content,
  align = "center"
}: { 
  children: React.ReactNode; 
  content: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        e.stopPropagation(); // Stop parent modal from closing
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape, true); // Use capture phase
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen]);

  const alignClass = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); } }}
        role="button"
        tabIndex={0}
      >
        {children}
      </div>
      {isOpen && (
        <div 
          className={cn("absolute top-[calc(100%+8px)] z-[70] bg-white rounded-xl shadow-lg border border-line/80 min-w-[260px] max-w-[340px] max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100", alignClass)}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------------

export function AdDetailDrawer({
  ad,
  saved = false,
  isPublicShare = false,
  onClose,
  onSave,
}: {
  ad: NormalizedAd;
  saved?: boolean;
  isPublicShare?: boolean;
  onClose: () => void;
  onSave?: () => Promise<void> | void;
}) {
  const [optimisticSaved, setOptimisticSaved] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  
  // Modals
  const [showShare, setShowShare] = useState(false);
  const [showSwipePicker, setShowSwipePicker] = useState(false);
  const swipeBtnRef = useRef<HTMLButtonElement>(null);
  
  // Download
  const [downloading, setDownloading] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const isSaved = saved || optimisticSaved;
  
  // Use canonical score from the ad payload
  const rawScore = ad.intelligence.winnerScore;
  const hasValidScore = rawScore !== undefined && rawScore !== null && !isNaN(rawScore);
  const clampedScore = hasValidScore ? Math.max(0, Math.min(100, rawScore || 0)) : null;
  const scoreTheme = clampedScore !== null ? getScoreTheme(clampedScore) : null;


  async function handleSave() {
    if (isSaved || saving) return;
    setSaving(true);
    try {
      if (onSave) {
        await onSave();
      }
      setOptimisticSaved(true);
    } catch {
      // Revert if failed
    } finally {
      setSaving(false);
    }
  }

  const handleDownload = async () => {
    let currentMediaUrl = safeExternalUrl(media.videoUrl || media.imageUrl);
    
    if (media.kind === "carousel" && media.cards?.length) {
       const slide = media.cards[activeSlideIndex];
       if (slide) {
         currentMediaUrl = safeExternalUrl(slide.imageUrl || slide.videoUrl);
       }
    }

    if (!currentMediaUrl) return;

    setDownloading(true);
    try {
      const res = await fetch(currentMediaUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `adshunting-creative-${ad.id || 'download'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed (may require server proxy due to CORS):", err);
    } finally {
      setDownloading(false);
    }
  }

  // Body Scroll Lock & ESC listener
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't close if a nested modal is open
      if (e.key === "Escape" && !showShare && !showSwipePicker) {
         // Note: If a MetadataPopover is open, its capture-phase listener will stopPropagation,
         // so this won't trigger.
         onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, showShare, showSwipePicker]);

  const media = resolveAdMedia(ad);
  const TABS = ["Overview", "Creative", "Copy", "Delivery", "Landing Page", "Advertiser"];
  const hasDownload = !!(media.videoUrl || media.imageUrl || media.carouselAssets?.length);

  // Computed display values
  const normalizedPlatforms = ad.delivery.platforms ? Array.from(new Set(ad.delivery.platforms.map(normalizePlatform))) : [];
  const platformsDisplay = normalizedPlatforms.length > 0 
    ? (normalizedPlatforms.length <= 2 ? normalizedPlatforms.join(" + ") : `${normalizedPlatforms[0]} +${normalizedPlatforms.length - 1}`)
    : null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-6 transition-all duration-200" 
      role="dialog" 
      aria-modal="true" 
      aria-label={`Ad details for ${ad.advertiser.name}`} 
      onMouseDown={() => {
        if (!showShare && !showSwipePicker) onClose();
      }}
    >
      <div 
        className="relative flex flex-col bg-white overflow-hidden shadow-2xl w-full h-[85vh] sm:h-auto sm:max-h-[calc(100vh-48px)] sm:w-[min(1180px,calc(100vw-64px))] sm:rounded-[16px] border border-line/60 animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={event => event.stopPropagation()}
      >
        {/* Sticky Header */}
        <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line/60 bg-white z-20">
          
          {/* Left: Advertiser */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-[1.5]">
            {ad.advertiser.logoUrl ? (
              <img src={ad.advertiser.logoUrl} alt="" className="size-9 sm:size-10 rounded-full border border-line/60 shrink-0 object-cover" />
            ) : (
              <span className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-full bg-ink font-[600] text-white text-[15px]">
                {ad.advertiser.name?.[0] || "U"}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[16px] sm:text-[18px] font-[600] text-ink leading-tight">{ad.advertiser.name || "Unknown advertiser"}</h2>
              <div className="hidden sm:flex items-center gap-2 mt-0.5 text-[12px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                <span>Sponsored Ad</span>
              </div>
            </div>
          </div>
          
          {/* Center: Interactive Metadata */}
          <div className="hidden lg:flex items-center justify-center gap-2 flex-[2] px-4 flex-wrap">
            
            {/* Active Control */}
            <MetadataPopover
              content={
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                     <span className={cn("size-2 rounded-full", ad.delivery.status === "active" ? "bg-brand" : "bg-zinc-400")} />
                     <span className="text-[14px] font-[650] text-ink">{ad.delivery.status === "active" ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-[650] uppercase tracking-wide text-muted mb-1">Started</p>
                      <p className="text-[13px] font-[500] text-ink">{ad.delivery.startedAt ? formatDate(ad.delivery.startedAt) : "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-[650] uppercase tracking-wide text-muted mb-1">Last Seen</p>
                      <p className="text-[13px] font-[500] text-ink">{ad.provider.fetchedAt ? formatDate(ad.provider.fetchedAt) : "Unknown"}</p>
                    </div>
                    {ad.delivery.daysRunning && (
                      <div className="col-span-2">
                        <p className="text-[11px] font-[650] uppercase tracking-wide text-muted mb-1">Observed Lifespan</p>
                        <p className="mt-2 text-sm font-semibold text-ink">
                {Array.isArray(ad.intelligence?.labels) && ad.intelligence!.labels.length > 0
                  ? ad.intelligence!.labels[0].replace(/\(.+\)/, "").trim()
                  : "Not enough data"}
              </p></div>
                    )}
                  </div>
                </div>
              }
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-[650] bg-brand text-brand border border-brand hover:bg-brand transition-colors">
                <span className="size-1.5 rounded-full bg-brand" /> {ad.delivery.status === "active" ? "Active" : "Inactive"}
              </button>
            </MetadataPopover>

            {/* Platform Control */}
            {platformsDisplay && (
              <MetadataPopover
                content={
                  <div className="p-4">
                    <p className="text-[12px] font-[650] uppercase tracking-wide text-muted mb-3">Running Platforms</p>
                    <div className="space-y-2 mb-4">
                      {normalizedPlatforms.map(p => (
                        <div key={p} className="text-[14px] font-[500] text-ink">{p}</div>
                      ))}
                    </div>
                  </div>
                }
              >
                <button className="inline-flex items-center px-3 py-1.5 rounded-[8px] text-[12px] font-[650] border bg-zinc-50 text-ink border-line/80 hover:bg-zinc-100 transition-colors">
                  {platformsDisplay}
                </button>
              </MetadataPopover>
            )}

            {/* Creative Control */}
            {media.kind && media.kind !== "unknown" && (
              <MetadataPopover
                content={
                  <div className="p-4 max-h-[300px] overflow-y-auto">
                    <p className="text-[12px] font-[650] uppercase tracking-wide text-muted mb-3">Creative Type</p>
                    <div className="text-[14px] font-[600] text-ink mb-4">{titleCase(media.kind)}</div>
                    
                    {media.kind === "carousel" && media.cards && media.cards.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[11px] font-[650] uppercase tracking-wide text-muted">Variations ({media.cards.length})</p>
                        {media.cards.map((item, idx) => (
                          <div 
                            key={idx} 
                            role="button"
                            tabIndex={0}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer group"
                            onClick={() => setActiveSlideIndex(idx)}
                            onKeyDown={(e) => { if(e.key==="Enter") setActiveSlideIndex(idx); }}
                          >
                             <div className="size-10 rounded-md bg-[#F8FAFC] border border-line flex items-center justify-center shrink-0 overflow-hidden">
                               {item.imageUrl || item.videoUrl ? (
                                 <img src={safeExternalUrl(item.imageUrl || item.videoUrl)!} alt="" className="w-full h-full object-cover" />
                               ) : <ImageIcon size={14} className="text-muted/50" />}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-[13px] font-[500] text-ink line-clamp-1 group-hover:text-brand transition-colors">
                                 {String(idx + 1).padStart(2, '0')} · {item.headline || "Slide"}
                               </p>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                }
              >
                <button className="inline-flex items-center px-3 py-1.5 rounded-[8px] text-[12px] font-[650] border bg-zinc-50 text-ink border-line/80 hover:bg-zinc-100 transition-colors">
                  {titleCase(media.kind)} {media.kind === "carousel" && media.cards ? `· ${media.cards.length}` : ""}
                </button>
              </MetadataPopover>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-[1.5]">
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
              <HeaderButton 
                icon={downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                label="Download" 
                onClick={handleDownload}
                disabled={!hasDownload || downloading}
                title={!hasDownload ? "Download unavailable" : "Download media"}
              />
              {!isPublicShare && (
                <>
                  <HeaderButton icon={<Share size={16} />} label="Share" onClick={() => setShowShare(true)} />
                  <HeaderButton 
                    ref={swipeBtnRef} 
                    icon={<LayoutTemplate size={16} />} 
                    label="Add to Swipe File" 
                    onClick={() => setShowSwipePicker(true)} 
                  />
                </>
              )}
            </div>
            
            {/* Mobile Actions Menu */}
            <div className="sm:hidden">
              <MetadataPopover
                align="right"
                content={
                  <div className="p-2 flex flex-col gap-1 min-w-[180px]">
                    <MobileMenuButton icon={<Download size={16} />} label="Download" onClick={handleDownload} disabled={!hasDownload} />
                    {!isPublicShare && (
                      <>
                        <MobileMenuButton icon={<Share size={16} />} label="Share" onClick={() => setShowShare(true)} />
                        <MobileMenuButton icon={<LayoutTemplate size={16} />} label="Swipe File" onClick={() => setShowSwipePicker(true)} />
                      </>
                    )}
                  </div>
                }
              >
                <button className="grid size-9 place-items-center rounded-lg text-ink hover:bg-zinc-100 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </MetadataPopover>
            </div>
            
            {!isPublicShare && (
              <button 
                onClick={handleSave} 
                disabled={isSaved || saving} 
                className={cn(
                  "flex items-center gap-2 h-9 px-3 sm:px-4 rounded-[8px] text-[13px] font-[600] transition-colors ml-1 sm:ml-2 shadow-sm",
                  isSaved || saving 
                    ? "bg-zinc-100 text-muted cursor-not-allowed border border-line" 
                    : "bg-brand text-white hover:bg-brand-strong border border-transparent hover:shadow-md"
                )}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : isSaved ? <Check size={15} /> : <Bookmark size={15} />}
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
              </button>
            )}
            <div className="w-px h-6 bg-line/60 mx-1 sm:mx-2" />
            <button onClick={onClose} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-zinc-100 transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-clip bg-white min-h-0">
          {/* Hero Section */}
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] max-w-[1180px] mx-auto p-4 sm:p-6 md:p-8 gap-8 md:gap-10 lg:items-start min-w-0">
            
            {/* Left: Creative Container */}
            <div className="flex flex-col gap-4">
              <AdCreativeViewer 
                ad={ad} 
              />
              
              {/* Carousel Thumbnail Strip */}
              {media.kind === "carousel" && media.cards && media.cards.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                  {media.cards.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={cn(
                        "relative shrink-0 h-16 w-16 md:h-18 md:w-18 rounded-[8px] overflow-hidden bg-[#F8FAFC] flex items-center justify-center transition-all",
                        activeSlideIndex === idx 
                          ? "border-[2px] border-brand shadow-sm" 
                          : "border border-line hover:border-zinc-300 opacity-80 hover:opacity-100"
                      )}
                    >
                      {item.imageUrl || item.videoUrl ? (
                         <img src={safeExternalUrl(item.imageUrl || item.videoUrl)!} alt={`Thumb ${idx+1}`} className="w-full h-full object-cover" />
                      ) : <ImageIcon size={14} className="text-muted/50" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Right: Dense Intelligence Column */}
            <div className="flex flex-col min-w-0 pb-6 gap-6">
              
              {/* Score Group */}
              <div>
                <h3 className="text-[11px] font-[600] uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                  AdsHunting Winning Score
                  <span title="Winning Score is calculated using observable ad signals available to AdsHunting. It does not represent ROAS, CTR, revenue or conversion performance.">
                    <Info size={14} className="cursor-help text-muted/70 hover:text-ink transition-colors" />
                  </span>
                </h3>
                
                {hasValidScore && scoreTheme ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-[34px] sm:text-[40px] font-[700] leading-none tracking-tight text-ink")}>{clampedScore}</span>
                      <span className="text-[14px] font-[500] text-muted">/ 100</span>
                      <span className={cn("ml-2 text-[14px] font-[600] text-ink", scoreTheme.text)}>{scoreTheme.label}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden mt-1">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-1000", scoreTheme.bg)} 
                        style={{ width: `${clampedScore}%` }} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[15px] font-[500] text-muted mb-4">Score unavailable</div>
                )}
              </div>
              
              <div className="w-full h-px bg-line/60" />

              {/* Delivery Group */}
              <div>
                <h3 className="text-[11px] font-[600] uppercase tracking-wider text-muted mb-3">Delivery</h3>
                <div className="flex flex-col gap-1.5">
                   <div className="flex items-center gap-2 text-[14px] font-[500] text-ink">
                     <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-[650] bg-zinc-100", ad.delivery.status === "active" ? "text-ink" : "text-muted")}>
                       <span className={cn("size-1.5 rounded-full", ad.delivery.status === "active" ? "bg-[#68B32F]" : "bg-zinc-400")} />
                       {ad.delivery.status === "active" ? "Active" : "Inactive"}
                     </span>
                     {ad.delivery.daysRunning && <span className="text-muted">· {ad.delivery.daysRunning} days</span>}
                   </div>
                   <div className="flex items-center gap-2 text-[13px] text-muted mt-1">
                     <span>{ad.delivery.startedAt ? formatDate(ad.delivery.startedAt) : "Unknown"}</span>
                     <ArrowRight size={14} className="text-line" />
                     <span>{ad.delivery.status === "active" ? "Running" : ad.delivery.endedAt ? formatDate(ad.delivery.endedAt) : ad.provider.fetchedAt ? formatDate(ad.provider.fetchedAt) : "Unknown"}</span>
                   </div>
                </div>
              </div>

              {/* Platforms Group */}
              {normalizedPlatforms.length > 0 && (
                <>
                  <div className="w-full h-px bg-line/60" />
                  <div>
                    <h3 className="text-[11px] font-[600] uppercase tracking-wider text-muted mb-3">Platforms</h3>
                    <div className="flex flex-wrap gap-2">
                      {normalizedPlatforms.map(p => (
                        <span key={p} className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-[500] bg-zinc-50 border border-line/60 text-ink">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="w-full h-px bg-line/60" />

              {/* Creative Intelligence Group */}
              <div>
                <h3 className="text-[11px] font-[600] uppercase tracking-wider text-muted mb-3">Creative Intelligence</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted uppercase tracking-wider font-[500] mb-0.5">Format</span>
                    <span className="text-[13px] font-[500] text-ink capitalize">{media.kind || "Unknown"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted uppercase tracking-wider font-[500] mb-0.5">Call to Action</span>
                    <span className="text-[13px] font-[500] text-ink">{ad.copy.cta || "None"}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[11px] text-muted uppercase tracking-wider font-[500] mb-0.5">Primary Copy</span>
                    <span className="text-[13px] font-[500] text-ink">{ad.copy.primaryText ? "Available" : "Missing"}</span>
                  </div>
                </div>
              </div>

              {/* Hook Group */}
              {(ad.intelligence?.hookType || ad.copy.headline || ad.copy.primaryText) && (
                <>
                  <div className="w-full h-px bg-line/60" />
                  <div>
                    <h3 className="text-[11px] font-[600] uppercase tracking-wider text-muted mb-2">Hook / Angle</h3>
                    <p className="text-[13px] font-[500] italic text-ink/80 leading-relaxed border-l-2 border-brand/40 pl-3">
                      &quot;{ad.intelligence?.hookType || sanitizeAdCopy(ad.copy.headline) || sanitizeAdCopy(ad.copy.primaryText)?.split('\n')[0]?.substring(0, 80) + '...'}&quot;
                    </p>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Sticky Tabs */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-y border-line/80 px-4 sm:px-6 md:px-8 pt-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-6 md:gap-8 max-w-[1440px] mx-auto overflow-x-auto no-scrollbar scroll-smooth">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "pb-3.5 text-[14px] font-[550] transition-colors whitespace-nowrap border-b-[2px]",
                    activeTab === tab 
                      ? "text-brand border-brand" 
                      : "text-muted border-transparent hover:text-ink"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-w-[1440px] mx-auto p-4 sm:p-6 md:p-8">
            {activeTab === "Overview" && <OverviewTab ad={ad} />}
            {activeTab === "Creative" && <CreativeTab ad={ad} />}
            {activeTab === "Copy" && <CopyTab ad={ad} />}
            {activeTab === "Delivery" && <DeliveryTab ad={ad} />}
            {activeTab === "Landing Page" && <LandingPageTab ad={ad} />}
            {activeTab === "Advertiser" && <AdvertiserTab ad={ad} />}
          </div>
        </div>
      </div>

      {/* Nested Modals */}
      <ShareModal 
        isOpen={showShare} 
        onClose={() => setShowShare(false)} 
        adIds={[ad.id]} 
        defaultName={`Ad from ${ad.advertiser.name}`} 
      />
      
      {showSwipePicker && (
        <SwipeFilePicker
          ad={ad}
          saved={isSaved}
          anchorRef={swipeBtnRef}
          onClose={() => setShowSwipePicker(false)}
          onAdded={() => setShowSwipePicker(false)}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------------
// Shared UI Components
// --------------------------------------------------------------------------------

const HeaderButton = React.forwardRef<HTMLButtonElement, { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, title?: string }>(
  ({ icon, label, onClick, disabled, title }, ref) => (
    <button 
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={label}
      className="hidden sm:flex size-9 items-center justify-center rounded-[8px] text-ink bg-white border border-line hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      {icon}
    </button>
  )
);
HeaderButton.displayName = "HeaderButton";

function MobileMenuButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-[14px] font-[500] text-ink hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      <span className="text-muted">{icon}</span> {label}
    </button>
  );
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button onClick={handleCopy} className="text-muted hover:text-brand transition-colors p-1.5 rounded-md hover:bg-brand" title="Copy text" aria-label="Copy">
      {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
    </button>
  );
}

// --------------------------------------------------------------------------------
// Viewers & Tabs
// --------------------------------------------------------------------------------

function AdCreativeViewer({ 
  ad, 
  className,
  style
}: { 
  ad: NormalizedAd; 
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerClass = "relative w-full bg-[#F5F5F5] rounded-[16px] border border-line/60 flex items-center justify-center overflow-hidden transition-all duration-200 h-fit max-w-full min-w-0 p-6 md:p-7" + (className ? ` ${className}` : "");
  const containerStyle = { maxHeight: "560px", ...style };

  return (
    <div className={containerClass} style={containerStyle}>
      <AdMedia ad={ad} variant="detail" className="w-full h-full" />
    </div>
  );
}

// --------------------------------------------------------------------------------
// Tab Layouts
// --------------------------------------------------------------------------------

function OverviewTab({ ad }: { ad: NormalizedAd }) {
  const media = resolveAdMedia(ad);
  return (
    <div className="grid lg:grid-cols-[64%_36%] gap-x-10 gap-y-12">
      <div className="space-y-10">
        <section>
          <h3 className="text-[16px] font-[650] text-ink mb-5">Ad Copy</h3>
          <div className="space-y-4">
            <CopyBlock text={ad.copy.primaryText} label="Primary Text" />
            {(ad.copy.headline || ad.copy.cta) && (
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                 <CopyBlock text={ad.copy.headline} label="Headline" />
                 <CopyBlock text={ad.copy.cta} label="Call to Action" />
              </div>
            )}
          </div>
        </section>
        
        {media.kind === "carousel" && media.cards && media.cards.length > 1 && (
          <section>
            <h3 className="text-[16px] font-[650] text-ink mb-5">Creative Variations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {media.cards.map((item, idx) => (
                 <CarouselVariationCard key={idx} item={item} index={idx} advertiserName={ad.advertiser.name || "Unknown"} fullWidth />
               ))}
            </div>
          </section>
        )}
      </div>
      
      <div className="space-y-10">
        <section>
          <h3 className="text-[16px] font-[650] text-ink mb-5">Advertiser</h3>
          <AdvertiserCard ad={ad} />
        </section>
        
        <section>
          <h3 className="text-[16px] font-[650] text-ink mb-5">Landing Page</h3>
          <WebsitePreviewCard url={ad.destination.url} title={ad.copy.headline} />
        </section>
      </div>
    </div>
  );
}

function CreativeTab({ ad }: { ad: NormalizedAd }) {
  const media = resolveAdMedia(ad);
  if (media.kind === "carousel" && media.cards && media.cards.length > 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {media.cards.map((item, idx) => (
           <CarouselVariationCard key={idx} item={item} index={idx} advertiserName={ad.advertiser.name || "Unknown"} fullWidth />
        ))}
      </div>
    );
  }
  return <div className="text-muted text-[14px] bg-white py-12 rounded-[16px] border border-line text-center">Standard creative view is available in the Overview tab.</div>;
}

function CopyTab({ ad }: { ad: NormalizedAd }) {
  return (
    <div className="max-w-3xl space-y-4">
      <CopyBlock text={ad.copy.primaryText} label="Primary Text" />
      <CopyBlock text={ad.copy.headline} label="Headline" />
      <CopyBlock text={ad.copy.description} label="Description" />
      <CopyBlock text={ad.copy.cta} label="Call to Action" />
    </div>
  );
}

function DeliveryTab({ ad }: { ad: NormalizedAd }) {
  return (
    <div className="max-w-2xl space-y-6">
       <div className="space-y-8 pl-4 border-l-2 border-line/60 py-2">
         <TimelineEvent label="Started running" date={ad.delivery.startedAt ? formatDate(ad.delivery.startedAt) : "Unknown"} active={false} />
         <TimelineEvent label="First seen" date={formatDate(ad.provider.fetchedAt)} active={false} />
         <TimelineEvent label="Last checked" date={formatDate(ad.provider.fetchedAt)} active={ad.delivery.status === "active"} />
         {ad.delivery.endedAt && <TimelineEvent label="Stopped running" date={formatDate(ad.delivery.endedAt)} active={false} />}
       </div>
    </div>
  );
}

function LandingPageTab({ ad }: { ad: NormalizedAd }) {
  return (
    <div className="max-w-2xl">
      <WebsitePreviewCard url={ad.destination.url} title={ad.copy.headline} />
    </div>
  );
}

function AdvertiserTab({ ad }: { ad: NormalizedAd }) {
  return (
    <div className="max-w-2xl">
      <AdvertiserCard ad={ad} detailed />
    </div>
  );
}

// --------------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------------

// Replaces the large padded CopyCard
function CopyBlock({ text, label }: { text?: string | null, label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  
  const MAX_LENGTH = 350;
  const isLong = text.length > MAX_LENGTH;
  const displayText = !isLong || expanded ? text : text.slice(0, MAX_LENGTH) + "...";

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[12px] font-[700] uppercase tracking-wide text-muted">{label}</span>
        <CopyButton text={text} />
      </div>
      <div className="bg-zinc-50/50 p-4 rounded-xl border border-line/60">
        <p className="text-[15px] text-ink leading-[1.6] whitespace-pre-wrap font-[400]">{displayText}</p>
        {isLong && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="mt-2 text-[13px] font-semibold text-brand hover:text-brand-strong transition-colors"
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        )}
      </div>
    </div>
  );
}

function CarouselVariationCard({ item, index, advertiserName, fullWidth = false }: { item: NonNullable<ReturnType<typeof resolveAdMedia>["cards"]>[number], index: number, advertiserName: string, fullWidth?: boolean }) {
  const media = safeExternalUrl(item.imageUrl || item.videoUrl);
  return (
    <div className={cn("bg-white rounded-[12px] border border-line shadow-sm overflow-hidden flex flex-col", fullWidth ? "w-full" : "w-[280px]")}>
      <div className="relative aspect-[4/5] bg-[#F8FAFC] flex items-center justify-center p-2 border-b border-line">
        {media ? (
           <img src={media} alt="Variation" className="w-full h-full object-contain rounded-[6px]" />
        ) : (
           <ImageIcon className="text-muted/50" size={32} />
        )}
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur px-2 py-0.5 rounded-[6px] text-[11px] font-[700] tracking-wide text-ink border border-line/60 shadow-sm">
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[13px] font-[500] text-ink line-clamp-2 leading-snug flex-1">{item.headline || advertiserName}</p>
        {item.destinationUrl && (
          <a href={item.destinationUrl} target="_blank" rel="noreferrer" className="mt-3 text-[12px] font-[600] text-brand hover:underline flex items-center gap-1 w-fit">
            <span className="truncate max-w-[180px]">{cleanUrl(item.destinationUrl)}</span> <ArrowRight size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ label, date, active }: { label: string, date: string, active: boolean }) {
  return (
    <div className="flex items-center gap-4 relative">
      <div className="absolute -left-[21px] flex flex-col items-center z-10 bg-white py-1">
        <div className={cn("size-2.5 rounded-full border-[2px]", active ? "bg-brand border-brand" : "bg-white border-line")} />
      </div>
      <div>
        <p className="text-[15px] font-[600] text-ink">{date}</p>
        <p className="text-[13px] font-[500] text-muted">{label}</p>
      </div>
    </div>
  );
}

function AdvertiserCard({ ad, detailed = false }: { ad: NormalizedAd, detailed?: boolean }) {
  return (
    <div className="bg-white rounded-[16px] border border-line p-5">
      <div className="flex items-center gap-4">
        {ad.advertiser.logoUrl ? (
          <img src={ad.advertiser.logoUrl} alt="" className="size-[48px] rounded-full border border-line/60 object-cover" />
        ) : (
          <span className="grid size-[48px] place-items-center rounded-full bg-ink font-[600] text-white text-[20px]">
            {ad.advertiser.name?.[0] || "U"}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-[650] text-ink truncate">{ad.advertiser.name || "Unknown"}</p>
          <div className="flex items-center gap-1.5 text-[13px] font-[500] text-muted mt-1">
            <Check size={12} className="text-brand" strokeWidth={3} /> Verified Advertiser
          </div>
        </div>
      </div>
      
      {detailed && (
        <div className="mt-5 pt-5 border-t border-line grid grid-cols-2 gap-4">
          <div>
            <p className="text-[12px] font-[650] uppercase tracking-wide text-muted mb-1">Page ID</p>
            <p className="text-[14px] font-[500] text-ink">{ad.advertiser.id}</p>
          </div>
        </div>
      )}
      
      <div className="mt-5">
         <Link href={`/brands/${encodeURIComponent(ad.advertiser.id || "unknown")}`} className="flex justify-center items-center h-10 rounded-lg bg-zinc-50 border border-line text-[13px] font-[650] text-ink hover:bg-zinc-100 transition-colors w-full">
           View Brand Intelligence <ArrowRight size={14} className="ml-1.5 text-muted" />
         </Link>
      </div>
    </div>
  );
}

function WebsitePreviewCard({ url, title }: { url?: string | null, title?: string | null }) {
  if (!url) return <div className="text-[14px] font-[500] text-muted">Landing page data not available.</div>;
  const domain = cleanUrl(url);
  return (
    <div className="bg-white rounded-[16px] border border-line overflow-hidden flex flex-col group">
       <div className="bg-[#F8FAFC] border-b border-line px-4 py-3 flex items-center gap-2">
         <Globe size={15} className="text-muted" />
         <span className="text-[13px] font-[550] text-ink truncate">{domain}</span>
         <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
           <CopyButton text={url} />
         </div>
       </div>
       <div className="p-5 flex flex-col gap-3">
         <div>
           <p className="text-[11px] font-[700] uppercase tracking-[0.08em] text-muted mb-1">Destination</p>
           <p className="text-[15px] font-[500] text-ink line-clamp-2 leading-relaxed">{title || "No page title available"}</p>
         </div>
         <a href={url} target="_blank" rel="noreferrer" className="mt-1 flex w-fit items-center gap-1.5 px-4 h-9 rounded-[8px] bg-zinc-50 border border-line text-ink text-[13px] font-[650] hover:bg-zinc-100 transition-colors">
           Open Link <ExternalLink size={14} className="text-muted" />
         </a>
       </div>
    </div>
  );
}
