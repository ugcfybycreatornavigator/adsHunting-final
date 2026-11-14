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
import { cn, formatDate, safeExternalUrl } from "@/lib/utils";

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
  content: React.ReactNode | ((close: () => void) => React.ReactNode);
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
          {typeof content === "function" ? content(() => setIsOpen(false)) : content}
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
  allowSharedSave = false,
  allowSharedDownload = false,
  onClose,
  onSave,
}: {
  ad: NormalizedAd;
  saved?: boolean;
  isPublicShare?: boolean;
  allowSharedSave?: boolean;
  allowSharedDownload?: boolean;
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
  const canDownload = !isPublicShare || allowSharedDownload;
  const canSave = !isPublicShare || allowSharedSave;
  const hasDownload = canDownload && !!(media.videoUrl || media.imageUrl || media.carouselAssets?.length);

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
        className="relative flex flex-col bg-white overflow-hidden shadow-2xl w-full h-[85vh] sm:h-auto sm:max-h-[calc(100vh-48px)] sm:w-[min(1280px,calc(100vw-64px))] sm:rounded-[16px] border border-line/60 animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={event => event.stopPropagation()}
      >
        {/* Sticky Header */}
        <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-line/60 bg-white/95 backdrop-blur z-20">
          {/* Left: Advertiser */}
          <div className="flex items-center gap-3 min-w-0 flex-[1.5]">
            {ad.advertiser.logoUrl ? (
              <img src={ad.advertiser.logoUrl} alt={`${ad.advertiser.displayName || ad.advertiser.name || "Advertiser"} logo`} className="size-9 rounded-full border border-line/60 shrink-0 object-cover" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-[600] text-white text-[15px]">
                {ad.advertiser.name?.[0] || "U"}
              </span>
            )}
            <div className="min-w-0 flex items-center gap-2">
              <h2 className="truncate text-[16px] font-[650] text-ink">{ad.advertiser.displayName || ad.advertiser.name || "Advertiser"}</h2>
              {/* Note: User explicitly said NO FAKE VERIFIED. So no verified icon unless it's in the data. There is no verified field in NormalizedAd */}
            </div>
            {/* Secondary Metadata */}
            <div className="hidden md:flex items-center gap-3 ml-4 border-l border-line/60 pl-4 text-[12px] font-[500] text-muted">
              <span className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", ad.delivery.status === "active" ? "bg-brand" : "bg-zinc-400")} />
                {ad.delivery.status === "active" ? "Active" : "Inactive"}
              </span>
              {media.kind && media.kind !== "unknown" && (
                <>
                  <span className="text-line">•</span>
                  <span className="capitalize">{media.kind}</span>
                </>
              )}
              {media.cards && media.cards.length > 1 && (
                <>
                  <span className="text-line">•</span>
                  <span>{media.cards.length} creatives</span>
                </>
              )}
              {platformsDisplay && (
                <>
                  <span className="text-line">•</span>
                  <span>{platformsDisplay}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <HeaderButton
                icon={downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                label="Download"
                onClick={handleDownload}
                disabled={!hasDownload || downloading}
                title={!hasDownload ? "Download unavailable" : "Download media"}
              />
              {!isPublicShare && (
                <HeaderButton icon={<Share size={15} />} label="Share" onClick={() => setShowShare(true)} />
              )}
              {canSave && (
                <HeaderButton
                  ref={swipeBtnRef}
                  icon={<LayoutTemplate size={15} />}
                  label="Add to Swipe File"
                  onClick={() => setShowSwipePicker(true)}
                />
              )}
            </div>

            {/* Mobile Actions Menu */}
            <div className="sm:hidden">
              <MetadataPopover
                align="right"
                content={(close) => (
                  <div className="p-2 flex flex-col gap-1 min-w-[180px]">
                    <MobileMenuButton icon={<Download size={16} />} label="Download" onClick={() => { handleDownload(); close(); }} disabled={!hasDownload} />
                    {!isPublicShare && (
                      <MobileMenuButton icon={<Share size={16} />} label="Share" onClick={() => { setShowShare(true); close(); }} />
                    )}
                    {canSave && <MobileMenuButton icon={<LayoutTemplate size={16} />} label="Swipe File" onClick={() => { setShowSwipePicker(true); close(); }} />}
                  </div>
                )}
              >
                <button className="grid size-8 place-items-center rounded-md text-ink hover:bg-zinc-100 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              </MetadataPopover>
            </div>

            {canSave && (
              <button
                onClick={() => setShowSwipePicker(true)}
                disabled={saving}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3 rounded-[6px] text-[13px] font-[600] transition-colors ml-1 shadow-sm",
                  isSaved || saving
                    ? "bg-zinc-100 text-muted border border-line"
                    : "bg-brand text-white hover:bg-brand-strong border border-transparent"
                )}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <Check size={14} /> : <Bookmark size={14} />}
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
              </button>
            )}
            <div className="w-px h-5 bg-line/60 mx-1 sm:mx-2" />
            <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-zinc-100 transition-colors" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-white min-h-0 custom-scrollbar">
          {/* Hero Section */}
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] max-w-[1440px] mx-auto p-4 sm:p-6 md:p-8 gap-8 lg:gap-12 lg:items-start min-w-0">

            {/* Left: Creative Container (55-58%) */}
            <div className="flex flex-col gap-4 min-w-0">
              <AdCreativeViewer ad={ad} />

              {/* Carousel Thumbnail Strip */}
              {media.kind === "carousel" && media.cards && media.cards.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                  {media.cards.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={cn(
                        "relative shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-[8px] overflow-hidden bg-[#F8FAFC] flex items-center justify-center transition-all",
                        activeSlideIndex === idx
                          ? "border-[2px] border-brand shadow-sm ring-2 ring-brand/20 ring-offset-1"
                          : "border border-line hover:border-zinc-300 opacity-80 hover:opacity-100"
                      )}
                    >
                      {item.imageUrl || item.videoUrl ? (
                         <img src={safeExternalUrl(item.imageUrl || item.videoUrl)!} alt={`Thumb ${idx+1}`} className="w-full h-full object-cover" />
                      ) : <ImageIcon size={14} className="text-muted/50" />}
                      <div className="absolute top-1 left-1 bg-white/95 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold text-ink shadow-sm">
                        {idx + 1}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Intelligence Summary (42-45%) */}
            <div className="flex flex-col min-w-0 gap-8">

              {/* 1. WINNER SCORE MODULE */}
              <WinnerScoreModule ad={ad} />

              {/* 2. AT A GLANCE */}
              <AtAGlanceGrid ad={ad} />

              {/* 3. PRIMARY MESSAGE / HOOK */}
              <MessagingModule ad={ad} />

              {/* 4. DELIVERY */}
              <DeliveryVisualization ad={ad} />

              {/* 5. PLATFORMS */}
              <PlatformsModule platforms={normalizedPlatforms} />

              {/* 6. ADVERTISER / BRAND ACTION */}
              <AdvertiserAction ad={ad} />

            </div>
          </div>

          {/* Sticky Tabs Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-y border-line/80 px-4 sm:px-6 md:px-8 pt-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-6 md:gap-8 max-w-[1440px] mx-auto overflow-x-auto no-scrollbar scroll-smooth">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "pb-3 text-[13px] font-[600] transition-colors whitespace-nowrap border-b-[2px]",
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

      {showSwipePicker && canSave && (
        <SwipeFilePicker
          ad={ad}
          saved={isSaved}
          anchorRef={swipeBtnRef}
          onClose={() => setShowSwipePicker(false)}
          onAdded={() => setShowSwipePicker(false)}
          onSaveDefault={handleSave}
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
      className="hidden sm:flex size-8 items-center justify-center rounded-[6px] text-ink bg-white border border-line hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
    <button onClick={handleCopy} className="text-muted hover:text-brand transition-colors p-1.5 rounded-md hover:bg-brand/10" title="Copy text" aria-label="Copy">
      {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
    </button>
  );
}

// --------------------------------------------------------------------------------
// Layout Specific Modules
// --------------------------------------------------------------------------------

function WinnerScoreModule({ ad }: { ad: NormalizedAd }) {
  const rawScore = ad.intelligence.winnerScore;
  const hasValidScore = rawScore !== undefined && rawScore !== null && !isNaN(rawScore);
  const clampedScore = hasValidScore ? Math.max(0, Math.min(100, rawScore || 0)) : null;
  const scoreTheme = clampedScore !== null ? getScoreTheme(clampedScore) : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted">AdsHunting Winner Score</h3>
        <MetadataPopover
          align="right"
          content={
            <div className="p-4 w-[280px]">
              <p className="text-[13px] font-[600] text-ink mb-2">How AdsHunting scores ads</p>
              <p className="text-[13px] text-muted mb-4 leading-relaxed">
                The Winner Score is calculated strictly using observable signals. It represents algorithmic potential, not actual revenue.
              </p>
              <p className="text-[11px] font-[650] uppercase tracking-wider text-muted mb-2">Scoring Factors Methodology</p>
              <ul className="text-[12px] font-[500] text-ink space-y-1.5">
                <li>• Longevity (35%)</li>
                <li>• Active Status (20%)</li>
                <li>• Creative Variations (15%)</li>
                <li>• Landing Page Persistence (10%)</li>
                <li>• Geographic Coverage (10%)</li>
                <li>• Creative Refresh Pattern (10%)</li>
              </ul>
            </div>
          }
        >
          <button className="text-muted/70 hover:text-ink transition-colors flex items-center gap-1">
            <Info size={14} />
          </button>
        </MetadataPopover>
      </div>

      {hasValidScore && scoreTheme ? (
        <div className="bg-zinc-50 rounded-[12px] p-4 border border-line/60">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[36px] font-[700] leading-none tracking-tight text-ink">{clampedScore}</span>
            <span className="text-[14px] font-[500] text-muted">/ 100</span>
            <span className={cn("ml-2 text-[14px] font-[600] tracking-wide", scoreTheme.text)}>{scoreTheme.label}</span>
          </div>

          {/* Progress Indicator */}
          <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000", scoreTheme.bg)}
              style={{ width: `${clampedScore}%` }}
            />
          </div>

        </div>
      ) : (
        <div className="bg-zinc-50 rounded-[12px] p-4 border border-line/60 text-[13px] font-[500] text-muted">
          Winner Score unavailable for this ad.
        </div>
      )}
    </section>
  );
}

function AtAGlanceGrid({ ad }: { ad: NormalizedAd }) {
  const media = resolveAdMedia(ad);
  const normalizedPlatforms = ad.delivery.platforms ? Array.from(new Set(ad.delivery.platforms.map(normalizePlatform))) : [];
  const platformsDisplay = normalizedPlatforms.length > 0
    ? (normalizedPlatforms.length <= 2 ? normalizedPlatforms.join(" + ") : `${normalizedPlatforms[0]} +${normalizedPlatforms.length - 1}`)
    : null;

  // Build grid data dynamically to omit empty rows
  const rows: { label: string, value: React.ReactNode }[] = [];

  // Status
  rows.push({
    label: "Status",
    value: <span className={cn("font-[600]", ad.delivery.status === "active" ? "text-brand" : "text-muted")}>{ad.delivery.status === "active" ? "Active" : "Inactive"}</span>
  });

  // Duration
  if (ad.delivery.daysRunning) {
    rows.push({ label: "Run duration", value: `${ad.delivery.daysRunning} days` });
  }

  // Dates
  if (ad.delivery.startedAt) {
    rows.push({ label: "First seen", value: formatDate(ad.delivery.startedAt) });
  }
  if (ad.provider.fetchedAt) {
    rows.push({ label: "Last seen", value: formatDate(ad.provider.fetchedAt) });
  }

  // Media
  if (media.kind && media.kind !== "unknown") {
    rows.push({ label: "Format", value: <span className="capitalize">{media.kind}</span> });
  }
  if (media.cards && media.cards.length > 0) {
    rows.push({ label: "Creatives", value: media.cards.length });
  }

  // Details
  if (ad.copy.cta) {
    rows.push({ label: "CTA", value: ad.copy.cta });
  }
  if (platformsDisplay) {
    rows.push({ label: "Platforms", value: platformsDisplay });
  }

  return (
    <section>
      <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-3">At a Glance</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-[11px] font-[500] text-muted mb-0.5">{row.label}</span>
            <span className="text-[13px] font-[500] text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MessagingModule({ ad }: { ad: NormalizedAd }) {
  const primaryText = ad.copy.primaryText;
  const hook = ad.intelligence?.hookType;

  if (!primaryText && !hook) return null;

  return (
    <section className="flex flex-col gap-4">
      {primaryText && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted">Primary Message</h3>
            <CopyButton text={primaryText} />
          </div>
          <div className="text-[13px] text-ink leading-[1.6] whitespace-pre-wrap font-[400] bg-zinc-50/50 p-3.5 rounded-xl border border-line/60">
            {primaryText.length > 250 ? primaryText.substring(0, 250) + "..." : primaryText}
          </div>
        </div>
      )}

      {hook && (
        <div>
          <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-2">Hook / Angle</h3>
          <div className="text-[13px] font-[500] italic text-ink/80 leading-relaxed border-l-[2px] border-brand/40 pl-3">
            {hook}
          </div>
        </div>
      )}
    </section>
  );
}

function DeliveryVisualization({ ad }: { ad: NormalizedAd }) {
  const firstSeen = ad.delivery.startedAt;
  const lastSeen = ad.delivery.endedAt || ad.provider.fetchedAt;

  // Need at least one valid date to show delivery
  if (!firstSeen && !lastSeen) return null;

  return (
    <section>
      <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-3">Delivery</h3>
      <div className="flex flex-col">
        {/* Timeline Line */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative h-1.5 bg-zinc-100 rounded-full">
            {/* If we have both dates and it ran for days, fill the line. Otherwise just a dot if one date. */}
            {firstSeen && lastSeen ? (
              <div className="absolute inset-y-0 left-0 bg-brand rounded-full" style={{ width: '100%' }} />
            ) : (
              <div className="absolute inset-y-0 left-0 bg-brand rounded-full w-2 h-2 -ml-0.5 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {/* Dates underneath */}
        <div className="flex justify-between items-start text-[12px]">
          {firstSeen && (
            <div className="flex flex-col">
              <span className="font-[500] text-muted">First seen</span>
              <span className="font-[600] text-ink">{formatDate(firstSeen)}</span>
            </div>
          )}
          {ad.delivery.daysRunning ? (
            <div className="flex flex-col items-center">
              <span className="font-[600] text-ink">{ad.delivery.daysRunning} days</span>
              <span className="font-[500] text-muted">observed</span>
            </div>
          ) : null}
          {lastSeen && (
            <div className="flex flex-col text-right">
              <span className="font-[500] text-muted">{ad.delivery.status === "active" ? "Running as of" : "Last seen"}</span>
              <span className="font-[600] text-ink">{formatDate(lastSeen)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlatformsModule({ platforms }: { platforms: string[] }) {
  if (!platforms || platforms.length === 0) return null;
  return (
    <section>
      <h3 className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-2">Platforms</h3>
      <div className="flex flex-wrap gap-2">
        {platforms.map(p => (
          <span key={p} className="text-[13px] font-[500] text-ink px-2.5 py-1 rounded-md bg-zinc-50 border border-line/60">
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}

function AdvertiserAction({ ad }: { ad: NormalizedAd }) {
  if (!ad.advertiser.id) return null;
  return (
    <section>
      <div className="w-full h-px bg-line/60 mb-5" />
      <Link href={`/competitors/${encodeURIComponent(ad.advertiser.id)}`} className="flex justify-between items-center p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-line/60 group">
        <div className="flex items-center gap-3">
          {ad.advertiser.logoUrl ? (
            <img src={ad.advertiser.logoUrl} alt={`${ad.advertiser.displayName || ad.advertiser.name || "Advertiser"} logo`} className="size-8 rounded-full border border-line/60 object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-ink font-[600] text-white text-[13px]">
              {ad.advertiser.name?.[0] || "U"}
            </span>
          )}
          <span className="text-[14px] font-[600] text-ink group-hover:text-brand transition-colors">{ad.advertiser.displayName || ad.advertiser.name}</span>
        </div>
        <ArrowRight size={16} className="text-muted group-hover:text-brand transition-colors" />
      </Link>
    </section>
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
  // Use object-contain styling in AdMedia but the container gives it space.
  const containerClass = "relative w-full bg-[#F5F5F5]/60 rounded-[12px] border border-line/60 flex items-center justify-center overflow-hidden transition-all duration-200 h-fit max-w-full min-w-0" + (className ? ` ${className}` : "");
  // Remove fixed max height to allow true aspect ratio containment
  const containerStyle = { ...style };

  return (
    <div className={containerClass} style={containerStyle}>
      <AdMedia ad={ad} variant="detail" className="w-full h-auto max-h-[75vh]" />
    </div>
  );
}

// --------------------------------------------------------------------------------
// Tab Layouts (Deep Details)
// --------------------------------------------------------------------------------

function OverviewTab({ ad }: { ad: NormalizedAd }) {
  return (
    <div className="grid lg:grid-cols-2 gap-x-10 gap-y-12">
      <div className="space-y-10">
        <section>
          <h3 className="text-[14px] font-[650] text-ink mb-4">Ad Copy Detail</h3>
          <div className="space-y-4">
            <CopyBlock text={ad.copy.primaryText} label="Primary Text" />
            <div className="grid sm:grid-cols-2 gap-4 mt-2">
               <CopyBlock text={ad.copy.headline} label="Headline" />
               <CopyBlock text={ad.copy.cta} label="Call to Action" />
            </div>
          </div>
        </section>
      </div>
      <div className="space-y-10">
        <section>
          <h3 className="text-[14px] font-[650] text-ink mb-4">Advertiser Profile</h3>
          <AdvertiserCard ad={ad} />
        </section>
        <section>
          <h3 className="text-[14px] font-[650] text-ink mb-4">Landing Page Details</h3>
          <WebsitePreviewCard url={ad.destination.url} title={ad.destination.title || ad.copy.headline} />
        </section>
      </div>
    </div>
  );
}

function CreativeTab({ ad }: { ad: NormalizedAd }) {
  const media = resolveAdMedia(ad);
  if (media.kind === "carousel" && media.cards && media.cards.length > 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {media.cards.map((item, idx) => (
           <CarouselVariationCard key={idx} item={item} index={idx} advertiserName={ad.advertiser.name || "Unknown"} fullWidth />
        ))}
      </div>
    );
  }
  return <div className="text-muted text-[13px] bg-zinc-50 py-12 rounded-[12px] border border-line text-center">Standard creative view is available in the media viewer above.</div>;
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
      <WebsitePreviewCard url={ad.destination.url} title={ad.destination.title || ad.copy.headline} />
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

function CopyBlock({ text, label }: { text?: string | null, label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const MAX_LENGTH = 350;
  const isLong = text.length > MAX_LENGTH;
  const displayText = !isLong || expanded ? text : text.slice(0, MAX_LENGTH) + "...";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-[600] uppercase tracking-widest text-muted">{label}</span>
        <CopyButton text={text} />
      </div>
      <div className="bg-zinc-50/50 p-4 rounded-[12px] border border-line/60">
        <p className="text-[13px] text-ink leading-[1.6] whitespace-pre-wrap font-[400]">{displayText}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[12px] font-semibold text-brand hover:text-brand-strong transition-colors"
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        )}
      </div>
    </div>
  );
}

function CarouselVariationCard({ item, index, advertiserName, fullWidth = false }: { item: NonNullable<ReturnType<typeof resolveAdMedia>["cards"]>[number], index: number, advertiserName: string, fullWidth?: boolean }) {
  const image = safeExternalUrl(item.imageUrl);
  const video = safeExternalUrl(item.videoUrl);
  return (
    <div className={cn("bg-white rounded-[12px] border border-line shadow-sm overflow-hidden flex flex-col", fullWidth ? "w-full" : "w-[280px]")}>
      <div className="relative bg-[#F8FAFC] flex items-center justify-center p-2 border-b border-line">
        {video ? (
           <video src={video} poster={image || undefined} muted playsInline controls className="w-full h-auto max-h-[500px] object-contain rounded-[6px]" />
        ) : image ? (
           <img src={image} alt="Variation" className="w-full h-auto max-h-[500px] object-contain rounded-[6px]" />
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
        <p className="text-[14px] font-[600] text-ink">{date}</p>
        <p className="text-[12px] font-[500] text-muted">{label}</p>
      </div>
    </div>
  );
}

function AdvertiserCard({ ad, detailed = false }: { ad: NormalizedAd, detailed?: boolean }) {
  return (
    <div className="bg-zinc-50/50 rounded-[12px] border border-line p-5">
      <div className="flex items-center gap-4">
        {ad.advertiser.logoUrl ? (
          <img src={ad.advertiser.logoUrl} alt={`${ad.advertiser.displayName || ad.advertiser.name || "Advertiser"} logo`} className="size-[48px] rounded-full border border-line/60 object-cover" />
        ) : (
          <span className="grid size-[48px] place-items-center rounded-full bg-ink font-[600] text-white text-[20px]">
            {ad.advertiser.name?.[0] || "U"}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-[650] text-ink truncate">{ad.advertiser.displayName || ad.advertiser.name || "Unknown"}</p>
          {/* Omitted fake verified badge per spec */}
        </div>
      </div>

      {detailed && ad.advertiser.id && (
        <div className="mt-5 pt-5 border-t border-line grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-1">Provider ID</p>
            <p className="text-[13px] font-[500] text-ink">{ad.advertiser.id}</p>
          </div>
        </div>
      )}

      {ad.advertiser.id && (
        <div className="mt-5">
           <Link href={`/brands/${encodeURIComponent(ad.advertiser.id)}`} className="flex justify-center items-center h-9 rounded-lg bg-white border border-line text-[13px] font-[600] text-ink hover:bg-zinc-50 transition-colors w-full">
             View Brand Intelligence <ArrowRight size={14} className="ml-1.5 text-muted" />
           </Link>
        </div>
      )}
    </div>
  );
}

function WebsitePreviewCard({ url, title }: { url?: string | null, title?: string | null }) {
  if (!url) return <div className="text-[13px] font-[500] text-muted p-4 bg-zinc-50 rounded-[12px] border border-line/60">Landing page data not available.</div>;
  const domain = cleanUrl(url);
  return (
    <div className="bg-white rounded-[12px] border border-line overflow-hidden flex flex-col group">
       <div className="bg-[#F8FAFC] border-b border-line px-4 py-2.5 flex items-center gap-2">
         <Globe size={14} className="text-muted" />
         <span className="text-[12px] font-[600] text-ink truncate">{domain}</span>
         <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
           <CopyButton text={url} />
         </div>
       </div>
       <div className="p-4 flex flex-col gap-3">
         <div>
           <p className="text-[10px] font-[600] uppercase tracking-widest text-muted mb-1">Destination</p>
           <p className="text-[13px] font-[500] text-ink line-clamp-2 leading-relaxed">{title || "No page title available"}</p>
         </div>
         <a href={url} target="_blank" rel="noreferrer" className="mt-1 flex w-fit items-center gap-1.5 px-3 h-8 rounded-[6px] bg-zinc-50 border border-line text-ink text-[12px] font-[600] hover:bg-zinc-100 transition-colors">
           Open Link <ExternalLink size={13} className="text-muted" />
         </a>
       </div>
    </div>
  );
}
