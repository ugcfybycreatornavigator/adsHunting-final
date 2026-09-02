"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { BRAND } from "@/lib/brand";
import { AnimatedProductCanvas } from "@/components/auth/animated-product-canvas";

export function AuthShell({ children, mode }: { children: ReactNode; mode: "sign-in" | "sign-up" }) {
  const title = mode === "sign-in" ? "Welcome back" : "Create your AdsHunting account";
  const body =
    mode === "sign-in"
      ? "Continue exploring winning ads, competitors, and creative signals."
      : "Start building your creative intelligence library.";

  return (
    <main className="min-h-screen bg-white text-ink lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
      {/* 60% Visual Side (Desktop/Tablet) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#080B12] px-12 pb-12 pt-14 lg:flex border-r border-line">
        
        {/* Animated Product Canvas */}
        <AnimatedProductCanvas />

        {/* Header Logo */}
        <div className="relative z-20">
          <BrandMark inverted compact href="/" />
        </div>

        {/* Product Messaging */}
        <div className="relative z-20 max-w-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-1000 motion-safe:delay-500 fill-mode-backwards">
          <h1 className="text-3xl font-bold leading-snug tracking-tight text-white mb-4">
            Find the ads worth studying.
          </h1>
          <p className="text-[16px] leading-relaxed text-white/60 max-w-md font-medium">
            Discover competitor creatives, understand the signals behind them, and save ideas that deserve a second look.
          </p>
          <div className="mt-8 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[.15em] text-white/40">
            <span className="text-white/80">Discover</span>
            <span className="text-brand">·</span>
            <span className="text-white/80">Analyze</span>
            <span className="text-brand">·</span>
            <span className="text-white/80">Save</span>
            <span className="text-brand">·</span>
            <span className="text-white/80">Research</span>
          </div>
        </div>
        
        {/* Subtle noise/gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#080B12] via-[#080B12]/80 to-transparent pointer-events-none z-10" />
      </section>

      {/* 40% Form Side */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 py-8 lg:px-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="mb-10 flex lg:hidden">
            <BrandMark compact href="/" />
          </div>

          <div className="mb-8">
            <h2 className="text-[32px] font-bold tracking-tight text-[#111217]">{title}</h2>
            <p className="mt-2 text-[15px] text-[#6F7380]">{body}</p>
          </div>

          {/* Clerk Form Injection */}
          <div className="w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
