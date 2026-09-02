'use client';

import React from 'react';

export function HeroOpticalBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#e6f4ea] to-[#f4faf6]"
      aria-hidden="true"
      style={{
        /* The hero section passes mouse coordinates to these vars */
        transform: `translate(
          calc(var(--hero-mouse-x, 0) * 15px),
          calc(var(--hero-mouse-y, 0) * 5px)
        )`,
        transition: 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        willChange: 'transform',
      }}
    >
      {/* ── Subsurface scattering / Liquid blobs ── */}
      <div 
        className="absolute inset-0 opacity-60"
        style={{ filter: 'blur(90px)', transform: 'translate3d(0,0,0)' }}
      >
        {/* Blob 1 */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#86efac] mix-blend-multiply"
          style={{ animation: 'water-flow-1 20s infinite alternate ease-in-out' }}
        />
        {/* Blob 2 */}
        <div 
          className="absolute top-[20%] right-[-10%] w-[50%] h-[70%] rounded-full bg-[#86efac] mix-blend-multiply"
          style={{ animation: 'water-flow-2 25s infinite alternate ease-in-out' }}
        />
        {/* Blob 3 */}
        <div 
          className="absolute bottom-[-20%] left-[20%] w-[70%] h-[60%] rounded-full bg-[#a7f3d0] mix-blend-multiply"
          style={{ animation: 'water-flow-3 22s infinite alternate ease-in-out' }}
        />
      </div>

      {/* ── Water Caustics / Ripple Overlay ── */}
      {/* Subtle SVG displacement filter to make the light bend like a water surface */}
      <svg className="absolute" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="water-ripple" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="3"
              seed="5"
              result="noise"
            >
              <animate 
                attributeName="baseFrequency" 
                values="0.012;0.015;0.012" 
                dur="30s" 
                repeatCount="indefinite" 
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="25"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* The layer that renders the water ripples */}
      <div 
        className="absolute inset-0 opacity-[0.2]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(94,169,32,0.2) 100%)',
          filter: 'url(#water-ripple)',
          transform: 'scale(1.1)', // hide edges
        }}
      />

      {/* ── Readability masks ── */}
      {/* Center white veil to ensure the hero text remains perfectly readable */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Bottom fade — gentle transition to page content */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, rgba(255,255,255,0.8) 85%, rgba(255,255,255,1) 100%)',
        }}
      />

      {/* Inline styles for the blob animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes water-flow-1 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15%, 10%) scale(1.1); }
          100% { transform: translate(-5%, 5%) scale(0.95); }
        }
        @keyframes water-flow-2 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15%, -10%) scale(1.05); }
          100% { transform: translate(10%, 15%) scale(0.9); }
        }
        @keyframes water-flow-3 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(10%, -15%) scale(1.1); }
          100% { transform: translate(-10%, 5%) scale(0.95); }
        }
      `}} />
    </div>
  );
}
