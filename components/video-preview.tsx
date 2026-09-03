"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, VolumeX, Volume2 } from "lucide-react";

export function VideoPreview({
  src,
  poster,
  className = "",
  controls = false,
  objectFit = "cover",
  onMetadata,
}: {
  src: string | string[];
  poster?: string | null;
  className?: string;
  controls?: boolean;
  objectFit?: "cover" | "contain";
  onMetadata?: (metadata: { width: number; height: number }) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [nearby, setNearby] = useState(controls);
  const [failed, setFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  
  const sources = Array.isArray(src) ? src : [src];
  const [currentSrcIndex, setCurrentSrcIndex] = useState(0);
  const currentSrc = sources[currentSrcIndex] || "";
  
  // Check if we have ANY valid sources
  const hasValidSources = sources.some(s => Boolean(s && s.trim()));

  // Diagnostic logging
  if (typeof window !== 'undefined') {
    console.log('[VideoPreview]', {
      sourceCount: sources.length,
      hasValidSources,
      currentSrcIndex,
      currentSrc: currentSrc.substring(0, 80),
      hasPoster: Boolean(poster),
      failed,
      playing,
      isMuted,
    });
  }
  
  // If we don't have any valid video sources, mark as failed immediately
  useEffect(() => {
    if (!hasValidSources && !failed) {
      console.log('[VideoPreview] No valid video sources, marking as failed');
      setFailed(true);
    }
  }, [hasValidSources, failed]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearby(true);
        if (!entry.isIntersecting) {
          ref.current?.pause();
          setPlaying(false);
        }
      },
      { rootMargin: "100px", threshold: 0.15 }
    );

    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearby || !pendingPlay.current) return;
    pendingPlay.current = false;
    const video = ref.current;
    if (!video) return;
    video.load();
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [nearby, currentSrc]);

  const srcString = JSON.stringify(sources);

  useEffect(() => {
    // Reset state if `src` array changes
    setCurrentSrcIndex(0);
    setFailed(false);
  }, [srcString]);

  async function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    
    // Don't try to play if we have no valid sources
    if (!hasValidSources) {
      return;
    }
    
    if (!nearby) {
      pendingPlay.current = true;
      setNearby(true);
      return;
    }
    const video = ref.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setPlaying(true);
      } else {
        video.pause();
        setPlaying(false);
      }
    } catch {
      setPlaying(false);
    }
  }

  return (
    <div ref={wrapperRef} className={`group relative overflow-hidden bg-zinc-100 flex items-center justify-center ${className}`}>
      <video
        ref={ref}
        src={currentSrc}
        poster={poster || undefined}
        muted={isMuted}
        playsInline
        preload={controls ? "metadata" : "none"}
        controls={controls && !failed}
        className={`w-auto h-auto max-w-full max-h-full ${objectFit === "contain" ? "object-contain" : "object-cover"}`}
        onLoadedMetadata={(event) => {
          setFailed(false);
          const video = event.currentTarget;
          if (video.videoWidth && video.videoHeight) {
            onMetadata?.({ width: video.videoWidth, height: video.videoHeight });
          }
        }}
        onError={() => {
          const nextIndex = currentSrcIndex + 1;
          console.log('[VideoPreview onError]', {
            currentIndex: currentSrcIndex,
            currentUrl: sources[currentSrcIndex]?.substring(0, 80),
            nextIndex,
            hasNextSource: nextIndex < sources.length,
            willFail: nextIndex >= sources.length,
          });
          if (nextIndex < sources.length) {
            setCurrentSrcIndex(nextIndex);
          } else {
            setFailed(true);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {failed && poster && (
        <div className="absolute top-3 right-3 z-10 rounded-[6px] bg-black/60 backdrop-blur px-2.5 py-1.5 border border-white/10 shadow-sm text-white flex items-center gap-2 pointer-events-none">
          <span className="text-[11px] font-[550] tracking-wide">Video preview &middot; Playback unavailable</span>
        </div>
      )}
      {failed && !poster && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-100 text-muted">
          <span className="text-xs font-semibold">Video unavailable</span>
        </div>
      )}
      {!controls && !failed && <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause preview" : "Play muted preview"}
        className="absolute bottom-2 left-2 z-10 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white border border-white/10 shadow-sm"
      >
        {playing ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play className="ml-0.5" size={14} fill="currentColor" />
        )}
      </button>}
      {!controls && !failed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsMuted(!isMuted);
          }}
          aria-label={isMuted ? "Unmute preview" : "Mute preview"}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 border border-white/10 shadow-sm text-[10px] font-medium tracking-wide text-white transition hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white"
        >
          {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />} {isMuted ? "Muted" : "Unmuted"}
        </button>
      )}
    </div>
  );
}
