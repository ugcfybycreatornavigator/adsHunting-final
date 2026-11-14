'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { LandingContainer } from '../layout/LandingContainer';
import { HeroOpticalBackground } from './HeroOpticalBackground';
import { HeroProductPreview } from './HeroProductPreview';
import { authLinks } from '@/data/landing/config';
import { ArrowRight, PlayCircle, X, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────
   ENTRANCE ANIMATION VARIANTS
   ───────────────────────────────────────────────────────────────────── */

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30, filter: 'blur(12px)', scale: 0.96 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 1.2,
      delay,
      ease: [0.19, 1, 0.22, 1] as const,
    },
  }),
};

const demoVideoSources = [
  {
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    label: 'Creative research walkthrough',
  },
  {
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    label: 'Ad workflow demo',
  },
  {
    src: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    label: 'Campaign review preview',
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────
   HERO SECTION
   ───────────────────────────────────────────────────────────────────── */

export function HeroSection() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<(typeof demoVideoSources)[number]>(demoVideoSources[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  // ── Mouse tracking (MotionValues — no React state updates) ──
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const smoothMouseX = useSpring(rawMouseX, { stiffness: 70, damping: 25, mass: 0.5 });
  const smoothMouseY = useSpring(rawMouseY, { stiffness: 70, damping: 25, mass: 0.5 });

  // ── Scroll parallax ──
  const { scrollY } = useScroll();
  const bgTranslateY = useTransform(scrollY, [0, 800], [0, 40]);
  const bgOpacity = useTransform(scrollY, [0, 600], [1, 0.45]);
  const bgScale = useTransform(scrollY, [0, 800], [1, 1.03]);

  // ── Apply mouse position as CSS custom properties (GPU-only) ──
  useEffect(() => {
    // Check for touch device / reduced motion
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReduced) return;

    let frameId: number;
    const updateCSSProps = () => {
      const el = bgRef.current;
      if (el) {
        el.style.setProperty('--hero-mouse-x', String(smoothMouseX.get().toFixed(4)));
        el.style.setProperty('--hero-mouse-y', String(smoothMouseY.get().toFixed(4)));
      }
      frameId = requestAnimationFrame(updateCSSProps);
    };
    frameId = requestAnimationFrame(updateCSSProps);

    return () => cancelAnimationFrame(frameId);
  }, [smoothMouseX, smoothMouseY]);

  // ── Mouse move handler ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // Normalized -1 to 1
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      rawMouseX.set(x);
      rawMouseY.set(y);
    },
    [rawMouseX, rawMouseY],
  );

  const handleMouseLeave = useCallback(() => {
    rawMouseX.set(0);
    rawMouseY.set(0);
  }, [rawMouseX, rawMouseY]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const openVideoModal = useCallback(() => {
    const nextVideo = demoVideoSources[Math.floor(Math.random() * demoVideoSources.length)];
    setActiveVideo(nextVideo);
    setIsPlaying(true);
    setIsMuted(false);
    setIsVideoModalOpen(true);
  }, []);

  const closeVideoModal = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsVideoModalOpen(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (videoContainerRef.current) {
          await videoContainerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore fullscreen errors
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('landing-video-open', isVideoModalOpen);
    document.body.style.overflow = isVideoModalOpen ? 'hidden' : '';

    return () => {
      document.body.classList.remove('landing-video-open');
      document.body.style.overflow = '';
    };
  }, [isVideoModalOpen]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden"
      style={{
        minHeight: '760px',
        background: 'linear-gradient(180deg, #ffffff 0%, #fafcff 100%)',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Animated optical background ── */}
      <motion.div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        style={{
          y: bgTranslateY,
          opacity: bgOpacity,
          scale: bgScale,
        }}
      >
        <HeroOpticalBackground />
      </motion.div>

      {/* ── Hero content ── */}
      <div className="relative z-20 pt-40 pb-20 md:pt-48 md:pb-32">
        <LandingContainer className="flex flex-col items-center text-center">
          <div className="max-w-[1000px] mx-auto">
            {/* Headline */}
            <motion.div
              custom={0.18}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
            >
              <h1
                className="text-balance mx-auto"
                style={{
                  fontSize: 'clamp(38px, 6vw, 84px)',
                  lineHeight: 0.98,
                  fontWeight: 700,
                  letterSpacing: '-0.045em',
                  color: '#0A0A0A',
                  maxWidth: '920px',
                }}
              >
                Find the ads worth{' '}
                <br className="hidden sm:block" />
                <span
                  style={{
                    background: 'linear-gradient(90deg, #2e7d32, #5ea920, #85d940)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  stealing inspiration from.
                </span>
              </h1>
            </motion.div>

            {/* Description */}
            <motion.div
              custom={0.28}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
            >
              <p
                className="mt-6 md:mt-8 text-balance mx-auto"
                style={{
                  fontSize: 'clamp(16px, 1.4vw, 20px)',
                  lineHeight: 1.6,
                  color: '#52525B',
                  maxWidth: '640px',
                }}
              >
                Search competitor creatives, review the details that matter, save useful inspiration, and share your research from one organized workspace.
              </p>
            </motion.div>

            {/* CTA area */}
            <motion.div
              custom={0.38}
              variants={fadeUpVariant}
              initial="hidden"
              animate="visible"
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {/* Primary CTA */}
              <Link
                href={authLinks.signUp}
                className="group inline-flex items-center justify-center h-[48px] md:h-[52px] px-7 md:px-8 text-[15px] md:text-[16px] font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] w-full sm:w-auto"
                style={{
                  borderRadius: '12px',
                  background: '#68B32F',
                  boxShadow: '0 1px 3px rgba(94,169,32,0.18), 0 4px 12px rgba(94,169,32,0.10)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#4F9223';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(94,169,32,0.22), 0 6px 16px rgba(94,169,32,0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#68B32F';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(94,169,32,0.18), 0 4px 12px rgba(94,169,32,0.10)';
                }}
              >
                Get Early Access
                <ArrowRight size={18} strokeWidth={2.5} className="ml-2 transition-transform duration-200 group-hover:translate-x-[3px]" />
              </Link>

              {/* Secondary CTA */}
              <button
                onClick={openVideoModal}
                className="inline-flex items-center justify-center h-[48px] md:h-[52px] px-7 md:px-8 text-[15px] md:text-[16px] font-semibold transition-all duration-200 w-full sm:w-auto"
                style={{
                  borderRadius: '12px',
                  color: '#0A0A0A',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(10,10,10,0.12)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(250,250,250,0.95)';
                  e.currentTarget.style.borderColor = 'rgba(10,10,10,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                  e.currentTarget.style.borderColor = 'rgba(10,10,10,0.12)';
                }}
              >
                <PlayCircle size={18} className="mr-2 text-text-primary" />
                See how it works
              </button>
            </motion.div>
          </div>

          {/* Product preview / search */}
          <motion.div
            custom={0.48}
            variants={fadeUpVariant}
            initial="hidden"
            animate="visible"
            className="w-full mt-16 md:mt-24 relative z-10"
          >
            <HeroProductPreview />
          </motion.div>
        </LandingContainer>
      </div>

      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isVideoModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#243331] p-4 sm:p-6 md:p-12">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onClick={closeVideoModal}
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(94,169,32,0.18),transparent_34%),linear-gradient(180deg,#32413f_0%,#202b29_100%)]"
                />
                <motion.div
                  ref={videoContainerRef}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 400, mass: 0.8 }}
                  className="group relative z-10 aspect-video w-full max-w-5xl overflow-hidden rounded-[24px] bg-black shadow-[0_0_100px_rgba(0,0,0,0.5),0_0_40px_rgba(94,169,32,0.15)] ring-1 ring-white/10"
                >
                  <video
                    ref={videoRef}
                    key={activeVideo.src}
                    src={activeVideo.src}
                    autoPlay
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={closeVideoModal}
                    aria-label={activeVideo.label}
                    onClick={togglePlayPause}
                    className="h-full w-full rounded-[24px] object-cover cursor-pointer"
                  >
                    Your browser does not support the video tag.
                  </video>


                  {/* Actions overlay: Pause/Play, Mute/Unmute, Fullscreen, Close */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 md:p-6 opacity-100 transition-opacity duration-300">
                    <div className="pointer-events-auto flex items-center gap-3">
                      {/* Play / Pause */}
                      <button
                        onClick={togglePlayPause}
                        aria-label={isPlaying ? 'Pause video' : 'Play video'}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/80"
                      >
                        {isPlaying ? (
                          <>
                            <Pause size={15} className="fill-white" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play size={15} className="fill-white" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      {/* Mute / Unmute */}
                      <button
                        onClick={toggleMute}
                        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/80"
                      >
                        {isMuted ? (
                          <>
                            <VolumeX size={15} />
                            <span>Unmute</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={15} />
                            <span>Mute</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="pointer-events-auto flex items-center gap-3">
                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-black/80"
                      >
                        {isFullscreen ? (
                          <>
                            <Minimize size={15} />
                            <span>Exit Fullscreen</span>
                          </>
                        ) : (
                          <>
                            <Maximize size={15} />
                            <span>Fullscreen</span>
                          </>
                        )}
                      </button>

                      {/* Close */}
                      <button
                        onClick={closeVideoModal}
                        aria-label="Close video"
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-red-500/80 hover:border-red-400"
                      >
                        <X size={15} strokeWidth={2.2} />
                        <span>Close</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </section>
  );
}
