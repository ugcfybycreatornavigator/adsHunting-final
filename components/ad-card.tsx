"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, FolderPlus, ImageIcon, Images, MoreHorizontal, PlaySquare, Share2, Loader2, Trash2, FileText, Tag } from "lucide-react";
import { AdMedia } from "@/components/ad-media";
import type { NormalizedAd } from "@/lib/types";
import { resolveAdMedia } from "@/lib/media";
import { safeExternalUrl, sanitizeAdCopy, cn } from "@/lib/utils";

// Extracted from original swipe file picker logic for inline use
import { SwipeFilePicker, type SwipeFileResult } from "@/components/swipe-file-picker";

export function AdCard({
  ad,
  saved,
  swipeFileCount = 0,
  onOpen,
  onSave,
  initialCollectionIds = [],
  onSwipeFileAdded,
  onShare,
  hasNote,
  tags,
  onNoteClick,
  onTagsClick,
  onRemoveClick,
}: {
  ad: NormalizedAd;
  saved?: boolean;
  swipeFileCount?: number;
  onOpen: () => void;
  onSave: () => Promise<void> | void;
  initialCollectionIds?: string[];
  onSwipeFileAdded?: (result: SwipeFileResult) => void;
  onShare: () => Promise<void> | void;
  hasNote?: boolean;
  tags?: { id: string; name: string }[];
  onNoteClick?: () => void;
  onTagsClick?: () => void;
  onRemoveClick?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [sharing] = useState(false);
  const [optimisticSaved, setOptimisticSaved] = useState(false);
  const isSaved = saved || optimisticSaved;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveBtnRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  
  // Reset failure states if the ad changes
  useEffect(() => {
    setAvatarFailed(false);
  }, [ad.id]);
  
  const mediaInfo = resolveAdMedia(ad);
  const landingPage = safeExternalUrl(ad.destination.url);
  const advertiserName = ad.advertiser.displayName || ad.advertiser.name || "Advertiser";
  const initial = advertiserName.slice(0, 1).toUpperCase() || "A";

  const displayCopy =
    sanitizeAdCopy(ad.copy.headline) ||
    sanitizeAdCopy(ad.copy.primaryText) ||
    sanitizeAdCopy(ad.copy.description);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <article className={cn(
      "group relative flex flex-col w-full rounded-[12px] border border-line bg-white shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md",
      menuOpen ? "z-50 overflow-visible" : "overflow-hidden z-10"
    )}>
      {/* Full-card accessible clickable overlay */}
      <div 
        className="absolute inset-0 z-0 cursor-pointer" 
        onClick={onOpen} 
        role="button" 
        tabIndex={0} 
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()} 
        aria-label={`Open ad by ${advertiserName}`}
      />
      
      {/* Header */}
      <div className="relative z-30 flex h-[52px] items-center gap-2.5 px-3">
        {ad.advertiser.logoUrl && !avatarFailed ? (
          <img 
            src={ad.advertiser.logoUrl} 
            alt="" 
            className="size-7 shrink-0 rounded-full border border-line object-cover bg-zinc-50" 
            loading="lazy"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black text-[10px] font-bold text-white">{initial}</span>
        )}
        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <Link
            href={`/brands/${encodeURIComponent(ad.advertiser.id || ad.id)}`}
            onClick={(event) => event.stopPropagation()}
            className="truncate text-[13px] font-semibold text-ink hover:text-signal"
          >
            {advertiserName}
          </Link>
          {ad.delivery.platforms && ad.delivery.platforms.length > 0 && (
            <span className="truncate text-[11px] text-muted font-medium">
              {ad.delivery.platforms.slice(0, 2).map(titleCase).join(" + ")}
            </span>
          )}
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-md text-muted hover:bg-zinc-50 transition"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-40 w-48 rounded-lg border border-line bg-white p-1 text-xs font-semibold shadow-card" role="menu">
              <Link 
                href={`/brands/${encodeURIComponent(ad.advertiser.id || ad.id)}`}
                role="menuitem" 
                onClick={() => setMenuOpen(false)} 
                className="flex min-h-9 items-center gap-2 rounded-md px-2.5 hover:bg-zinc-50"
              >
                <ExternalLink size={14} />
                Visit advertiser
              </Link>
              {landingPage && (
                <a href={landingPage} target="_blank" rel="noreferrer noopener" role="menuitem" onClick={() => setMenuOpen(false)} className="flex min-h-9 items-center gap-2 rounded-md px-2.5 hover:bg-zinc-50">
                  <ExternalLink size={14} />
                  Visit landing page
                </a>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={sharing}
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-zinc-50 disabled:opacity-50"
                onClick={async () => {
                  await onShare();
                  setMenuOpen(false);
                }}
              >
                <Share2 size={14} />
                Copy share link
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left hover:bg-zinc-50"
                onClick={async () => {
                  await copyText(ad.externalId || ad.id);
                  setMenuOpen(false);
                }}
              >
                <Copy size={14} />
                Copy Ad ID
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media 4:5 - clicking video requests full screen or plays directly, clicking card overview opens ad details */}
      <div 
        className="relative z-10 aspect-[4/5] w-full bg-[#F5F5F5] overflow-hidden border-y border-line group-hover:border-zinc-300 transition-colors cursor-pointer"
        onClick={(e) => {
          // If video element is clicked, trigger native fullscreen or play
          const videoEl = e.currentTarget.querySelector("video");
          if (videoEl) {
            e.stopPropagation();
            interface WebkitVideoElement extends HTMLVideoElement {
              webkitRequestFullscreen?: () => Promise<void> | void;
              webkitEnterFullscreen?: () => void;
            }
            const webkitVideo = videoEl as WebkitVideoElement;

            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            } else if (videoEl.requestFullscreen) {
              videoEl.requestFullscreen().catch(() => {});
            } else if (typeof webkitVideo.webkitRequestFullscreen === "function") {
              webkitVideo.webkitRequestFullscreen();
            } else if (typeof webkitVideo.webkitEnterFullscreen === "function") {
              webkitVideo.webkitEnterFullscreen();
            }
          }
        }}
      >
        <div className="absolute inset-0">
          <AdMedia ad={ad} variant="card" />
        </div>
      </div>

      {/* Metadata Section */}
      <div className="relative z-0 flex flex-col gap-2.5 p-3 pb-4 pointer-events-none">
        
        {/* Status + Score */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <span className={cn("size-1.5 rounded-full", ad.delivery.status === "active" ? "bg-[#68B32F]" : "bg-zinc-300")} />
            {ad.delivery.status === "active" ? "Active" : "Inactive"}
          </span>
          {ad.intelligence.winnerScore != null && (
             <span className="text-[11px] font-semibold text-ink">Score {ad.intelligence.winnerScore}</span>
          )}
        </div>

        {/* Copy */}
        <div className="flex items-start justify-between gap-2">
          {displayCopy ? (
            <p className="line-clamp-2 text-[13px] font-medium leading-[1.4] text-ink whitespace-pre-wrap">{displayCopy}</p>
          ) : (
            <p className="text-[13px] italic text-muted">No copy available</p>
          )}
        </div>

        {/* Runtime + Format */}
        <div className="flex items-center justify-between text-[11px] font-medium text-muted mt-1">
          <span className="truncate">{ad.delivery.daysRunning ? `${ad.delivery.daysRunning} days running` : "New"}</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted capitalize">
            {mediaInfo.kind === "video" ? <PlaySquare size={13} /> : mediaInfo.kind === "carousel" ? <Images size={13} /> : <ImageIcon size={13} />}
            {mediaInfo.kind}
          </span>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="relative z-10 flex w-full h-[38px] border-t border-line" ref={saveBtnRef}>
        <button 
          type="button"
          disabled={saving}
          onClick={(event) => {
             event.preventDefault();
             event.stopPropagation();
             setShowPicker(true);
          }}
          className={cn("flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold transition disabled:opacity-100", (isSaved || swipeFileCount > 0) ? "text-[#68B32F]" : "text-muted hover:bg-zinc-50 hover:text-ink")}
          aria-label={isSaved ? "Organize saved ad" : "Choose where to save"}
        >
          {saving ? <Loader2 size={14} className="shrink-0 animate-spin" /> : (isSaved || swipeFileCount > 0) ? <Check size={14} className="shrink-0" /> : <FolderPlus size={14} className="shrink-0" />}
          <span>{saving ? "Saving..." : (isSaved || swipeFileCount > 0) ? "Organize" : "Save"}</span>
        </button>

        <div className="w-[1px] bg-line" />

        <button
          type="button"
          onClick={async (e) => {
             e.preventDefault();
             await onShare();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold text-muted hover:bg-zinc-50 hover:text-ink transition"
          aria-label="Share"
        >
          <Share2 size={14} className="opacity-80" />
          <span>Share</span>
        </button>

        {onRemoveClick && (
          <>
            <div className="w-[1px] bg-line" />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveClick(); }}
              className="flex items-center justify-center w-10 text-muted hover:bg-zinc-50 hover:text-signal transition"
              title="Remove from Saved Ads"
              aria-label="Remove from Saved Ads"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Optional Note/Tag Row for Saved Ads View */}
      {(onNoteClick || onTagsClick) && (
        <div className="relative z-10 flex w-full min-h-[38px] border-t border-line">
          {onNoteClick && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNoteClick(); }}
              className={cn("flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold transition text-muted hover:bg-zinc-50 hover:text-ink")}
            >
              <FileText size={14} className={hasNote ? "text-signal" : ""} />
              <span>{hasNote ? "Note added" : "Add note"}</span>
            </button>
          )}
          {onNoteClick && onTagsClick && <div className="w-[1px] bg-line" />}
          {onTagsClick && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagsClick(); }}
              className={cn("flex flex-1 items-center justify-center gap-1.5 text-[12px] font-semibold transition text-muted hover:bg-zinc-50 hover:text-ink")}
            >
              <Tag size={14} className={(tags && tags.length > 0) ? "text-signal" : ""} />
              <span>Tags {(tags && tags.length > 0) ? `(${tags.length})` : ""}</span>
            </button>
          )}
        </div>
      )}
      
      {showPicker && (
        <SwipeFilePicker
          ad={ad}
          saved={isSaved}
          initialCollectionIds={initialCollectionIds}
          anchorRef={saveBtnRef}
          onClose={() => setShowPicker(false)}
          onAdded={onSwipeFileAdded}
          onSaveDefault={async () => {
            setSaving(true);
            try {
              await onSave();
              setOptimisticSaved(true);
            } catch (error) {
              setOptimisticSaved(false);
              throw error;
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </article>
  );
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    document.body.removeChild(field);
  }
}
