"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion, useInView, AnimatePresence, animate } from "framer-motion";
import { TrendingUp, Layers, Bookmark, CheckCircle2 } from "lucide-react";

// --- ASSET CONFIGURATION LAYER ---
// These are temporary recognizable local assets.
// When actual global brand assets (Adidas, Nike, etc.) are available, replace these paths.
const CREATIVE_ASSETS = [
  {
    id: "hero",
    image: "/brand/creatives/creative_tech_01.jpg",
    brand: "Advertiser", // Neutral placeholder
    format: "Video",
    aspect: "9/16",
    filename: "campaign_hero.mp4"
  },
  {
    id: "secondary_1",
    image: "/brand/creatives/creative_fashion_01.jpg",
    brand: "Advertiser",
    format: "Image",
    aspect: "4/5",
    filename: "competitor-feed.png"
  },
  {
    id: "secondary_2",
    image: "/brand/creatives/creative_fitness_01.jpg",
    brand: "Advertiser",
    format: "Image",
    aspect: "4/5",
    filename: "saved-ad-17.png"
  },
  {
    id: "secondary_3",
    image: "/brand/creatives/creative_food_01.jpg",
    brand: "Advertiser",
    format: "Image",
    aspect: "1/1",
    filename: "research-03.jpg"
  },
  {
    id: "secondary_4",
    image: "/brand/creatives/creative_beauty_01.jpg",
    brand: "Advertiser",
    format: "Image",
    aspect: "4/5",
    filename: "static_ad.jpg"
  }
];

// --- TIMELINE ---
type Phase =
  | "chaos"        // 0.0–1.8s
  | "recognition"  // 1.8–3.0s
  | "structure"    // 3.0–4.6s
  | "scoreReveal"  // 4.6–6.3s
  | "intelligence" // 6.3–8.1s
  | "save"         // 8.1–10.0s
  | "final"        // 10.0–12.4s
  | "hold"         // 12.4–13.2s
  | "reset";       // 13.2–14.0s

const TIMELINE = {
  recognition: 1800,
  structure: 3000,
  scoreReveal: 4600,
  intelligence: 6300,
  save: 8100,
  final: 10000,
  hold: 12400,
  reset: 13200,
  loop: 14000
};

// --- CHOREOGRAPHY DATA ---
const CARD_POSITIONS = {
  hero: {
    chaos: { x: 40, y: -20, r: 3, s: 0.95 },
    structured: { x: 0, y: -60, r: 0, s: 1 },
    scoreReveal: { x: -40, y: -60, r: 0, s: 1.04 }, // Shifts left to make room for docked score
  },
  secondary_1: {
    chaos: { x: -160, y: -120, r: -5, s: 0.9 },
    structured: { x: -240, y: -80, r: 0, s: 0.85 },
  },
  secondary_2: {
    chaos: { x: 180, y: 100, r: -4, s: 0.9 },
    structured: { x: -180, y: 140, r: 0, s: 0.8 }, // Bottom left
  },
  secondary_3: {
    chaos: { x: 150, y: -110, r: 4, s: 0.85 },
    structured: { x: -380, y: 40, r: 0, s: 0.7 }, // Pushed far back
  },
  secondary_4: {
    chaos: { x: -120, y: 150, r: 6, s: 0.85 },
    structured: { x: 160, y: -160, r: 0, s: 0.75 }, // Top right
  }
};

export function CreativeIntelligenceAnimation() {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { margin: "0px", amount: 0.2 });

  const [phase, setPhase] = useState<Phase>("chaos");
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase("final");
      setScore(78);
      return;
    }

    if (!isInView) {
      setPhase("chaos");
      setScore(0);
      return;
    }

    let isMounted = true;
    const timeouts: NodeJS.Timeout[] = [];

    const schedule = (targetPhase: Phase, delayMs: number) => {
      const t = setTimeout(() => {
        if (isMounted) setPhase(targetPhase);
      }, delayMs);
      timeouts.push(t);
    };

    const runLoop = () => {
      setPhase("chaos");
      setScore(0);
      schedule("recognition", TIMELINE.recognition);
      schedule("structure", TIMELINE.structure);
      schedule("scoreReveal", TIMELINE.scoreReveal);
      schedule("intelligence", TIMELINE.intelligence);
      schedule("save", TIMELINE.save);
      schedule("final", TIMELINE.final);
      schedule("hold", TIMELINE.hold);
      schedule("reset", TIMELINE.reset);
    };

    runLoop();
    const interval = setInterval(runLoop, TIMELINE.loop);

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [isInView, prefersReducedMotion]);

  // Animate Score Counter independently during scoreReveal
  useEffect(() => {
    if (phase === "scoreReveal" || phase === "intelligence" || phase === "save" || phase === "final" || phase === "hold") {
      const controls = animate(0, 78, {
        duration: 0.8,
        ease: "easeOut",
        onUpdate: (val) => setScore(Math.round(val))
      });
      return controls.stop;
    } else {
      setScore(0);
    }
  }, [phase]);

  // Derived state booleans
  const isChaos = phase === "chaos" || phase === "reset";
  const isRecognition = phase === "recognition";
  const isStructured = ["structure", "scoreReveal", "intelligence", "save", "final", "hold"].includes(phase);
  const hasScore = ["scoreReveal", "intelligence", "save", "final", "hold"].includes(phase);
  const hasIntelligence = ["intelligence", "save", "final", "hold"].includes(phase);
  const isSaving = ["save", "final", "hold"].includes(phase);
  const isResetting = phase === "reset";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[550px] sm:h-[650px] flex items-center justify-center overflow-hidden rounded-[20px] bg-[#FAFAFA] border border-[#E4E4E7]"
      style={{
        backgroundImage: `
          radial-gradient(circle at 60% 40%, rgba(94,169,32,0.025), transparent 60%),
          linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 48px 48px, 48px 48px'
      }}
    >
      {/* Background Soft Reset Wash */}
      <AnimatePresence>
        {isResetting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-[#FAFAFA] z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="relative w-full max-w-[900px] h-full flex items-center justify-center scale-[0.65] sm:scale-90 md:scale-100">

        {/* --- CONNECTOR PATHS (SVG) --- */}
        <AnimatePresence>
          {hasIntelligence && (
            <motion.svg
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            >
              {/* Pattern Connectors (Linking Secondary 1 & Hero to Pattern block) */}
              <path d="M 240 245 L 280 245" stroke="rgba(94,169,32,0.25)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
              <path d="M 410 400 L 460 380" stroke="rgba(94,169,32,0.25)" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* --- CREATIVE CARDS --- */}
        {CREATIVE_ASSETS.map((asset, idx) => {
          const isHero = asset.id === "hero";
          const posData = CARD_POSITIONS[asset.id as keyof typeof CARD_POSITIONS];

          let target = posData.chaos;
          if (isStructured) target = posData.structured;
          if (hasScore && isHero && 'scoreReveal' in posData) target = posData.scoreReveal; // Hero shifts for score

          // 3-Plane Depth Calculation
          const isBackground = !isHero && idx > 2;
          const isMidground = !isHero && idx <= 2;

          let zLevel = 20 - idx;
          if (isStructured && isHero) zLevel = 40;
          if (isStructured && isBackground) zLevel = 5;

          return (
            <motion.div
              key={asset.id}
              initial={false}
              animate={{
                x: target.x,
                y: target.y,
                rotate: target.r,
                scale: target.s,
                opacity: (isStructured && isBackground) ? 0.4 : 1, // Desaturate distant cards
                zIndex: zLevel
              }}
              transition={{
                x: { type: "spring", bounce: 0, duration: 1.2 }, // Cubic-like smooth transition
                y: { type: "spring", bounce: 0, duration: 1.2 },
                rotate: { duration: 1.2, ease: [0.22, 1, 0.36, 1] },
                scale: { duration: 1.2, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.8 }
              }}
              className="absolute bg-white rounded-[14px] overflow-hidden border border-[#E4E4E7]"
              style={{
                width: asset.aspect === "9/16" ? 170 : asset.aspect === "4/5" ? 180 : 160,
                aspectRatio: asset.aspect,
                boxShadow: (isRecognition && isHero)
                  ? "0 0 0 1.5px #68B32F, 0 15px 35px -5px rgba(94,169,32,0.2)"
                  : isHero && isStructured
                    ? "0 30px 60px -15px rgba(0,0,0,0.15)"
                    : isMidground && isStructured
                      ? "0 10px 25px -5px rgba(0,0,0,0.08)"
                      : "0 4px 12px -2px rgba(0,0,0,0.05)"
              }}
            >
              {/* Asset Image */}
              <img src={asset.image} alt="Creative" className="w-full h-full object-cover" />

              {/* Focus Brackets (Recognition Phase) */}
              <AnimatePresence>
                {isRecognition && isHero && (
                  <motion.div
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-2 border border-white/50 rounded-lg pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Chaos Fake Filenames */}
              <AnimatePresence>
                {isChaos && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute bottom-2 left-2 text-[10px] font-mono text-[#71717A] bg-white/90 px-1.5 py-0.5 rounded shadow-sm backdrop-blur-md"
                  >
                    {asset.filename}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Structured Metadata Layer */}
              <AnimatePresence>
                {isStructured && (isHero || isMidground) && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ delay: 0.4 }}
                    className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="bg-white/95 backdrop-blur-md px-2 py-1 rounded shadow-sm text-[11px] font-bold text-[#18181B]">
                        {asset.brand}
                      </div>
                      {isHero && (
                        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1 rounded shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          <span className="text-[10px] font-bold text-[#18181B]">Active</span>
                        </div>
                      )}
                    </div>
                    {/* Footer */}
                    {isHero && (
                      <div className="flex items-center gap-2 mt-auto">
                        <div className="bg-white/95 backdrop-blur-md px-2 py-1.5 rounded shadow-sm flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#71717A]">Video</span>
                          <span className="text-[10px] font-bold text-[#18181B]">128 days</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Saved Micro-State */}
              <AnimatePresence>
                {isSaving && !isHero && isMidground && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center z-10"
                  >
                    <div className="bg-[#68B32F] text-white text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* --- DOCKED WINNING SCORE --- */}
        <AnimatePresence>
          {hasScore && (
            <motion.div
              initial={{ opacity: 0, x: -20, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 1 }}
              className="absolute left-[54%] top-[25%] bg-white border border-[#E4E4E7] shadow-xl rounded-[14px] p-5 z-40 w-[180px] perspective-[1000px]"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#68B32F]" />
                <span className="text-[10px] font-bold text-[#71717A] tracking-widest uppercase">Winning Score</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[40px] font-bold text-[#18181B] leading-none tracking-tight">{score}</span>
                <span className="text-[12px] font-bold text-[#A1A1AA]">/ 100</span>
              </div>
              <span className="text-[12px] font-semibold text-[#68B32F] block mb-4">Strong Potential</span>

              <div className="w-full h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#68B32F] rounded-full"
                  style={{ width: `${score}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- RUNNING ON PLATFORMS --- */}
        <AnimatePresence>
          {hasIntelligence && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="absolute left-[54%] top-[55%] bg-white border border-[#E4E4E7] shadow-lg rounded-[12px] p-3 z-40"
            >
              <span className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-2 block">Running On</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#18181B]">Facebook</span>
                <span className="text-[#D4D4D8]">•</span>
                <span className="text-[11px] font-bold text-[#18181B]">Instagram</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- CREATIVE PATTERN --- */}
        <AnimatePresence>
          {hasIntelligence && (
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="absolute bottom-[20%] right-[10%] bg-[#111217] text-white px-5 py-3 rounded-[14px] shadow-2xl z-40"
            >
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-[#68B32F]" />
                <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Creative Pattern</span>
              </div>
              <span className="text-[14px] font-semibold tracking-tight">Product-led hook</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- FLYING THUMBNAILS (Cinematic Save Transition) --- */}
        <AnimatePresence>
          {isSaving && (
            <>
              {CREATIVE_ASSETS.slice(1, 3).map((asset, i) => {
                const pos = CARD_POSITIONS[asset.id as keyof typeof CARD_POSITIONS].structured;
                return (
                  <motion.div
                    key={`fly-${asset.id}`}
                    initial={{ x: pos.x, y: pos.y, scale: pos.s, opacity: 0 }}
                    animate={{ x: 10 + (i * 50), y: 220, scale: 0.3, opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      delay: 0.2 + (i * 0.15),
                      duration: 0.9,
                      ease: [0.22, 1, 0.36, 1],
                      opacity: { times: [0, 0.1, 1], duration: 0.9 }
                    }}
                    className="absolute z-50 rounded-[14px] overflow-hidden shadow-2xl pointer-events-none"
                    style={{
                      width: asset.aspect === "9/16" ? 170 : asset.aspect === "4/5" ? 180 : 160,
                      aspectRatio: asset.aspect,
                    }}
                  >
                    <img src={asset.image} alt="Flying Thumb" className="w-full h-full object-cover" />
                  </motion.div>
                );
              })}
            </>
          )}
        </AnimatePresence>

        {/* --- WINNING CREATIVES SWIPE FILE --- */}
        <AnimatePresence>
          {isSaving && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="absolute bottom-[5%] bg-white border border-[#E4E4E7] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] rounded-[16px] p-5 z-30 w-full max-w-[440px]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F4F9F0] flex items-center justify-center">
                    <Bookmark className="w-4 h-4 text-[#68B32F] fill-current" />
                  </div>
                  <div>
                    <span className="text-[14px] font-bold text-[#18181B] block">Winning Creatives</span>
                    <span className="text-[11px] font-bold text-[#A1A1AA]">Saved research • Product-led</span>
                  </div>
                </div>
                <span className="text-[12px] font-bold text-[#71717A] bg-[#F4F4F5] px-2 py-1 rounded-md">12 Ads</span>
              </div>

              <div className="flex items-center gap-2.5">
                {CREATIVE_ASSETS.slice(1).map((asset, i) => (
                  <motion.div
                    key={`thumb-${asset.id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.0 + (i * 0.15) }}
                    className="w-14 h-14 rounded-xl bg-white border border-[#E4E4E7] overflow-hidden flex-shrink-0 shadow-sm"
                  >
                    <img src={asset.image} alt="thumb" className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
