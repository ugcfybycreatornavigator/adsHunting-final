"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PlaySquare, BarChart3, TrendingUp, Layers, Activity } from "lucide-react";

export function AnimatedProductCanvas() {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setMounted(true);
    const timeout = setTimeout(() => {
      setScore(78);
    }, 600);
    return () => clearTimeout(timeout);
  }, []);

  if (!mounted) return null;

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 10, scale: 0.96 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: custom * 0.1,
        duration: prefersReducedMotion ? 0 : 0.6,
        ease: [0.16, 1, 0.3, 1] as const
      }
    })
  };

  const float = (delay: number, duration: number) => ({
    animate: prefersReducedMotion ? {} : {
      y: [0, -6, 0],
      transition: {
        duration,
        repeat: Infinity,
        ease: "easeInOut" as const,
        delay
      }
    }
  });

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#080B12] flex items-center justify-center">
      {/* Subtle Technical Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #FFFFFF 1px, transparent 1px),
            linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Electric Blue Radial Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(94,169,32,0.08) 0%, transparent 65%)'
        }}
      />

      {/* Product Ecosystem Container */}
      <div className="relative w-[600px] h-[500px] select-none pointer-events-none">

        {/* --- SIGNAL PATHS --- */}
        {!prefersReducedMotion && (
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
            {/* Connection: Central to Score (Top Right) */}
            <path id="path-score" d="M 300 250 L 480 140" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            <circle r="3" fill="#68B32F" opacity="0.6">
              <animateMotion dur="3s" repeatCount="indefinite" calcMode="linear">
                <mpath href="#path-score" />
              </animateMotion>
            </circle>

            {/* Connection: Competitor to Central (Bottom Left) */}
            <path id="path-comp" d="M 140 380 L 300 250" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            <circle r="3" fill="#68B32F" opacity="0.6">
              <animateMotion dur="4s" repeatCount="indefinite" calcMode="linear">
                <mpath href="#path-comp" />
              </animateMotion>
            </circle>

            {/* Connection: Central to Platforms (Bottom Right) */}
            <path id="path-plat" d="M 300 250 L 460 360" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            <circle r="3" fill="#68B32F" opacity="0.6">
              <animateMotion dur="3.5s" repeatCount="indefinite" calcMode="linear">
                <mpath href="#path-plat" />
              </animateMotion>
            </circle>
          </svg>
        )}

        {/* --- CENTRAL AD CARD --- */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <motion.div
            className="w-[260px] bg-[#101622]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            {...float(0, 6)}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <span className="text-[10px] font-bold text-black">N</span>
                </div>
                <span className="text-white text-xs font-semibold">Nike</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/20">
                <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span className="text-[10px] font-medium text-[#16A34A]">Active</span>
              </div>
            </div>

            {/* Faux Creative */}
            <div className="h-[200px] w-full bg-[#1A2132] flex items-center justify-center relative">
              <PlaySquare className="text-white/20 w-10 h-10" strokeWidth={1.5} />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md text-[9px] text-white/80 font-medium flex items-center gap-1">
                <Activity className="w-3 h-3 text-brand" /> Running 85 days
              </div>
            </div>

            {/* Footer Signals */}
            <div className="px-4 py-3 bg-[#0B1018]/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Format</span>
                <span className="text-[11px] text-white/90">Video</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-brand w-[78%] rounded-full" />
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* --- WINNING SCORE (Top Right) --- */}
        <motion.div
          className="absolute top-[80px] right-[40px] z-10"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          custom={1.5}
        >
          <motion.div
            className="w-[180px] bg-[#101622]/90 backdrop-blur-xl border border-brand/20 rounded-xl p-4 shadow-[0_0_30px_rgba(94,169,32,0.15)]"
            {...float(0.5, 7)}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-brand" />
              <span className="text-[11px] text-white/60 font-semibold uppercase tracking-wider">Winning Score</span>
            </div>
            <div className="flex items-end gap-1 mb-1">
              <motion.span
                className="text-3xl font-bold text-white leading-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {score}
              </motion.span>
              <span className="text-xs text-white/40 mb-1">/ 100</span>
            </div>
            <span className="text-[11px] font-medium text-brand">Strong Potential</span>
          </motion.div>
        </motion.div>

        {/* --- COMPETITOR (Bottom Left) --- */}
        <motion.div
          className="absolute bottom-[90px] left-[40px] z-10"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          custom={2.5}
        >
          <motion.div
            className="w-[170px] bg-[#101622]/80 backdrop-blur-xl border border-white/10 rounded-xl p-3"
            {...float(1.2, 8.5)}
          >
            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Competitor</span>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                <span className="text-[12px] font-bold text-black">N</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Nike</div>
                <div className="text-[10px] text-white/50">Verified Brand</div>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-white/60">Active Ads</span>
              <span className="text-[11px] font-bold text-white">124</span>
            </div>
          </motion.div>
        </motion.div>

        {/* --- RUNNING PLATFORMS (Bottom Right) --- */}
        <motion.div
          className="absolute bottom-[60px] right-[60px] z-10"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          custom={3.5}
        >
          <motion.div
            className="w-[160px] bg-[#101622]/80 backdrop-blur-xl border border-white/10 rounded-xl p-3"
            {...float(2.0, 6.5)}
          >
            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Running On</span>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-[4px] bg-[#1877F2]/20 flex items-center justify-center">
                  <span className="text-[10px] text-[#1877F2] font-bold">f</span>
                </div>
                <span className="text-[11px] text-white/80 font-medium">Facebook</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-[4px] bg-[#E1306C]/20 flex items-center justify-center">
                  <span className="text-[10px] text-[#E1306C] font-bold">IG</span>
                </div>
                <span className="text-[11px] text-white/80 font-medium">Instagram</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
}
