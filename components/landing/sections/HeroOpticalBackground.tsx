'use client';

import React from 'react';

/* ─────────────────────────────────────────────────────────────────────
   DETERMINISTIC GLASS STRIP CONFIGURATION
   Each strip is fully defined at build time — no Math.random(), no
   hydration mismatch. Values tuned for a lenticular / fluted glass look.
   ───────────────────────────────────────────────────────────────────── */

interface StripConfig {
  width: number;        // px
  left: number;         // % offset from container left
  blur: number;         // backdrop-filter blur in px
  opacity: number;      // 0–1
  scaleX: number;       // subtle horizontal lens compression
  animName: string;     // keyframe name
  animDuration: string; // e.g. "14s"
  animDelay: string;    // stagger
  highlightAlpha: number; // left edge white highlight
  shadowAlpha: number;    // right edge blue shadow
}

// 30 strips for desktop — hand-tuned widths and positions
const STRIPS: StripConfig[] = [
  { width: 30, left: 0.5,  blur: 5, opacity: 0.52, scaleX: 1.00, animName: 'hero-strip-sway-1', animDuration: '14s', animDelay: '0s',    highlightAlpha: 0.45, shadowAlpha: 0.10 },
  { width: 44, left: 3.8,  blur: 7, opacity: 0.48, scaleX: 1.01, animName: 'hero-strip-sway-2', animDuration: '18s', animDelay: '0.5s',  highlightAlpha: 0.52, shadowAlpha: 0.12 },
  { width: 36, left: 7.2,  blur: 4, opacity: 0.55, scaleX: 1.00, animName: 'hero-strip-sway-3', animDuration: '12s', animDelay: '1.2s',  highlightAlpha: 0.40, shadowAlpha: 0.08 },
  { width: 54, left: 10.5, blur: 8, opacity: 0.42, scaleX: 0.99, animName: 'hero-strip-sway-1', animDuration: '20s', animDelay: '0.8s',  highlightAlpha: 0.55, shadowAlpha: 0.13 },
  { width: 28, left: 14.8, blur: 5, opacity: 0.58, scaleX: 1.01, animName: 'hero-strip-sway-2', animDuration: '15s', animDelay: '2.0s',  highlightAlpha: 0.38, shadowAlpha: 0.09 },
  { width: 48, left: 17.3, blur: 7, opacity: 0.45, scaleX: 1.00, animName: 'hero-strip-sway-3', animDuration: '17s', animDelay: '0.3s',  highlightAlpha: 0.50, shadowAlpha: 0.11 },
  { width: 32, left: 21.0, blur: 5, opacity: 0.53, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '13s', animDelay: '1.5s',  highlightAlpha: 0.42, shadowAlpha: 0.09 },
  { width: 58, left: 24.2, blur: 9, opacity: 0.38, scaleX: 0.99, animName: 'hero-strip-sway-2', animDuration: '22s', animDelay: '0.7s',  highlightAlpha: 0.58, shadowAlpha: 0.14 },
  { width: 26, left: 28.5, blur: 4, opacity: 0.62, scaleX: 1.00, animName: 'hero-strip-sway-3', animDuration: '11s', animDelay: '1.8s',  highlightAlpha: 0.36, shadowAlpha: 0.08 },
  { width: 40, left: 31.0, blur: 6, opacity: 0.50, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '16s', animDelay: '2.3s',  highlightAlpha: 0.48, shadowAlpha: 0.11 },
  { width: 50, left: 34.8, blur: 8, opacity: 0.40, scaleX: 0.99, animName: 'hero-strip-sway-2', animDuration: '19s', animDelay: '0.4s',  highlightAlpha: 0.52, shadowAlpha: 0.12 },
  { width: 34, left: 38.2, blur: 5, opacity: 0.55, scaleX: 1.00, animName: 'hero-strip-sway-3', animDuration: '14s', animDelay: '1.0s',  highlightAlpha: 0.40, shadowAlpha: 0.09 },
  { width: 24, left: 41.5, blur: 4, opacity: 0.65, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '10s', animDelay: '2.5s',  highlightAlpha: 0.34, shadowAlpha: 0.08 },
  { width: 46, left: 44.0, blur: 7, opacity: 0.35, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '21s', animDelay: '0.6s',  highlightAlpha: 0.50, shadowAlpha: 0.12 },
  { width: 38, left: 47.8, blur: 6, opacity: 0.48, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '15s', animDelay: '1.3s',  highlightAlpha: 0.45, shadowAlpha: 0.10 },
  { width: 56, left: 51.0, blur: 8, opacity: 0.36, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '23s', animDelay: '0.9s',  highlightAlpha: 0.55, shadowAlpha: 0.13 },
  { width: 30, left: 55.2, blur: 5, opacity: 0.56, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '12s', animDelay: '2.1s',  highlightAlpha: 0.38, shadowAlpha: 0.09 },
  { width: 42, left: 58.0, blur: 7, opacity: 0.44, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '18s', animDelay: '0.2s',  highlightAlpha: 0.50, shadowAlpha: 0.11 },
  { width: 52, left: 61.5, blur: 8, opacity: 0.39, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '20s', animDelay: '1.7s',  highlightAlpha: 0.52, shadowAlpha: 0.13 },
  { width: 28, left: 65.8, blur: 4, opacity: 0.58, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '13s', animDelay: '2.4s',  highlightAlpha: 0.36, shadowAlpha: 0.08 },
  { width: 48, left: 68.5, blur: 7, opacity: 0.42, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '17s', animDelay: '0.5s',  highlightAlpha: 0.50, shadowAlpha: 0.11 },
  { width: 36, left: 72.0, blur: 6, opacity: 0.52, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '15s', animDelay: '1.1s',  highlightAlpha: 0.42, shadowAlpha: 0.09 },
  { width: 60, left: 75.2, blur: 9, opacity: 0.34, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '24s', animDelay: '0.8s',  highlightAlpha: 0.60, shadowAlpha: 0.14 },
  { width: 32, left: 79.5, blur: 5, opacity: 0.54, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '14s', animDelay: '2.0s',  highlightAlpha: 0.40, shadowAlpha: 0.09 },
  { width: 44, left: 82.0, blur: 7, opacity: 0.46, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '16s', animDelay: '1.4s',  highlightAlpha: 0.48, shadowAlpha: 0.11 },
  { width: 26, left: 86.0, blur: 4, opacity: 0.60, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '11s', animDelay: '2.6s',  highlightAlpha: 0.34, shadowAlpha: 0.08 },
  { width: 40, left: 88.5, blur: 6, opacity: 0.50, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '18s', animDelay: '0.3s',  highlightAlpha: 0.45, shadowAlpha: 0.10 },
  { width: 54, left: 91.8, blur: 8, opacity: 0.38, scaleX: 1.01, animName: 'hero-strip-sway-1', animDuration: '21s', animDelay: '1.6s',  highlightAlpha: 0.55, shadowAlpha: 0.13 },
  { width: 34, left: 95.0, blur: 5, opacity: 0.54, scaleX: 1.00, animName: 'hero-strip-sway-2', animDuration: '13s', animDelay: '2.2s',  highlightAlpha: 0.40, shadowAlpha: 0.09 },
  { width: 46, left: 97.5, blur: 7, opacity: 0.42, scaleX: 0.99, animName: 'hero-strip-sway-3', animDuration: '19s', animDelay: '0.7s',  highlightAlpha: 0.50, shadowAlpha: 0.12 },
];

// Mobile subset — use every other strip roughly for 14 strips
const MOBILE_STRIP_INDICES = [0, 2, 5, 8, 10, 13, 15, 18, 20, 22, 24, 26, 28, 29];

/* ─────────────────────────────────────────────────────────────────────
   GREEN LIGHT FIELD CONFIGURATION
   ───────────────────────────────────────────────────────────────────── */

interface LightField {
  width: string;
  height: string;
  top: string;
  left: string;
  background: string;
  blur: number;
  animName: string;
  animDuration: string;
}

const LIGHT_FIELDS: LightField[] = [
  {
    width: '60vw', height: '50vw', top: '0%', left: '50%',
    background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.35) 0%, rgba(94,169,32,0.12) 45%, transparent 75%)',
    blur: 90, animName: 'hero-light-drift-1', animDuration: '18s',
  },
  {
    width: '52vw', height: '42vw', top: '20%', left: '5%',
    background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.28) 0%, rgba(94,169,32,0.08) 50%, transparent 75%)',
    blur: 100, animName: 'hero-light-drift-2', animDuration: '22s',
  },
  {
    width: '45vw', height: '55vw', top: '-15%', left: '25%',
    background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.22) 0%, rgba(94,169,32,0.06) 45%, transparent 70%)',
    blur: 80, animName: 'hero-light-drift-3', animDuration: '16s',
  },
  {
    width: '40vw', height: '35vw', top: '45%', left: '65%',
    background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.20) 0%, rgba(94,169,32,0.05) 55%, transparent 75%)',
    blur: 95, animName: 'hero-light-drift-4', animDuration: '24s',
  },
  {
    width: '35vw', height: '40vw', top: '10%', left: '-8%',
    background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.16) 0%, rgba(94,169,32,0.03) 60%, transparent 75%)',
    blur: 70, animName: 'hero-light-drift-5', animDuration: '14s',
  },
];


/* ─────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────── */

export function HeroOpticalBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{
        /* Mouse-reactive transforms are applied via CSS custom properties
           set by the parent HeroSection. Defaults to 0 if not set. */
        transform: `translate(
          calc(var(--hero-mouse-x, 0) * 12px),
          calc(var(--hero-mouse-y, 0) * 4px)
        )`,
        transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        willChange: 'transform',
      }}
    >
      {/* ── Layer 1: Base gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fafcff 100%)',
        }}
      />

      {/* ── Faint tech grid ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(94,169,32,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(94,169,32,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
          animation: 'hero-grid-pulse 20s ease-in-out infinite',
        }}
      />

      {/* ── Layer 2: Moving green light fields ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(
            calc(var(--hero-mouse-x, 0) * 12px),
            calc(var(--hero-mouse-y, 0) * 6px)
          )`,
          transition: 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {LIGHT_FIELDS.map((field, i) => (
          <div
            key={`light-${i}`}
            className="absolute rounded-[50%]"
            style={{
              width: field.width,
              height: field.height,
              top: field.top,
              left: field.left,
              background: field.background,
              filter: `blur(${field.blur}px)`,
              animation: `${field.animName} ${field.animDuration} cubic-bezier(0.45, 0, 0.55, 1) infinite`,
              willChange: 'transform',
            }}
          />
        ))}
      </div>

      {/* ── SVG Displacement filter (subtle organic distortion) ── */}
      <svg className="absolute" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="hero-refraction" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008"
              numOctaves="2"
              seed="42"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="3"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* ── Layer 3: Refractive glass strip field ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateX(calc(var(--hero-mouse-x, 0) * 4px))`,
          transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          filter: 'url(#hero-refraction)',
        }}
      >
        {/* Desktop strips */}
        <div className="hidden md:block absolute inset-0">
          {STRIPS.map((strip, i) => (
            <GlassStrip key={`d-${i}`} config={strip} />
          ))}
        </div>
        {/* Mobile strips */}
        <div className="md:hidden absolute inset-0">
          {MOBILE_STRIP_INDICES.map((idx) => {
            const strip = STRIPS[idx];
            // Remap left positions evenly for mobile
            const mobileLeft = (MOBILE_STRIP_INDICES.indexOf(idx) / MOBILE_STRIP_INDICES.length) * 100;
            return (
              <GlassStrip
                key={`m-${idx}`}
                config={{ ...strip, left: mobileLeft, width: Math.max(strip.width * 0.8, 20) }}
              />
            );
          })}
        </div>
      </div>

      {/* ── Layer 4: Readability masks ── */}

      {/* Center white veil — subtle, just enough for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 45% 40% at 50% 38%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 55%, transparent 100%)',
        }}
      />

      {/* Bottom fade — gentle transition to page content */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(255,255,255,0.6) 80%, rgba(255,255,255,0.95) 100%)',
        }}
      />

      {/* Left/right edge fade — soft vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgba(255,255,255,0.45) 0%, transparent 15%, transparent 85%, rgba(255,255,255,0.45) 100%)',
        }}
      />
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────
   GLASS STRIP SUB-COMPONENT
   ───────────────────────────────────────────────────────────────────── */

function GlassStrip({ config }: { config: StripConfig }) {
  const {
    width, left, blur, opacity, scaleX,
    animName, animDuration, animDelay,
    highlightAlpha, shadowAlpha,
  } = config;

  return (
    <div
      className="absolute top-0 h-full"
      style={{
        width: `${width}px`,
        left: `${left}%`,
        opacity,
        transform: `scaleX(${scaleX})`,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        background: `linear-gradient(
          90deg,
          rgba(255,255,255,${highlightAlpha}) 0%,
          rgba(255,255,255,0.02) 30%,
          rgba(94,169,32,${shadowAlpha}) 55%,
          rgba(255,255,255,${highlightAlpha * 0.6}) 100%
        )`,
        boxShadow: `
          inset 1px 0 0 rgba(255,255,255,${highlightAlpha + 0.05}),
          inset -1px 0 0 rgba(94,169,32,${shadowAlpha}),
          0 0 1px rgba(94,169,32,0.03)
        `,
        borderLeft: `1px solid rgba(255,255,255,${highlightAlpha * 0.8})`,
        borderRight: `1px solid rgba(94,169,32,${shadowAlpha * 0.5})`,
        animation: `${animName} ${animDuration} cubic-bezier(0.45, 0, 0.55, 1) ${animDelay} infinite`,
        willChange: 'transform, opacity',
        ['--strip-opacity' as string]: opacity,
      }}
    />
  );
}
