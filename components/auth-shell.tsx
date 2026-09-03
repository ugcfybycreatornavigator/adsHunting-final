"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function AuthShell({ children, mode }: { children: ReactNode; mode: "sign-in" | "sign-up" }) {
  const title = mode === "sign-in" ? "Welcome to AdsHunting" : "Create your AdsHunting account";
  const body =
    mode === "sign-in"
      ? "Log in to continue tracking competitors, saving creative signals, and building sharper ad research."
      : "Start your creative intelligence workspace and build a cleaner way to research ads.";

  return (
    <main className="flex min-h-[100dvh] flex-col overflow-hidden bg-white text-ink lg:flex-row">
      <section className="auth-visual-panel relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[#2F8F32] px-7 py-7 text-white sm:min-h-[360px] sm:px-10 sm:py-10 lg:min-h-[100dvh] lg:w-[60%] lg:px-14 lg:py-14 xl:px-16">
        <div className="auth-diagonal-stack absolute inset-0" aria-hidden="true">
          <div className="auth-diagonal auth-diagonal-one" />
          <div className="auth-diagonal auth-diagonal-two" />
          <div className="auth-diagonal auth-diagonal-three" />
          <div className="auth-neon-line auth-neon-line-one" />
          <div className="auth-neon-line auth-neon-line-two" />
          <div className="auth-dot-field auth-dot-field-one" />
          <div className="auth-dot-field auth-dot-field-two" />
        </div>

        <div className="relative z-10 max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 motion-safe:duration-700">
          <p className="mb-4 inline-flex rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase text-lime-50 backdrop-blur-md">
            Creative Intelligence
          </p>
          <h1 className="text-[32px] font-black leading-[1.08] text-white sm:text-[44px] lg:text-[52px]">
            Empowering the ad research revolution
          </h1>
        </div>

        <div className="relative z-10 mt-12 max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-200 motion-safe:duration-700">
          <p className="text-[14px] font-semibold leading-relaxed text-white">
            &quot;A focused swipe file turns scattered inspiration into decisions your team can trust.&quot;
          </p>
          <p className="mt-3 text-[12px] font-bold uppercase text-lime-50/85">AdsHunting</p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-[#FEFFFD] px-5 py-10 sm:px-8 sm:py-12 lg:min-h-[100dvh] lg:w-[40%] lg:px-10 xl:px-14">
        <div className="w-full max-w-[420px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-700">
          <div className="mb-8 flex justify-center">
            <BrandMark compact href="/" />
          </div>

          <div className="mb-7 text-center">
            <h2 className="text-[28px] font-extrabold leading-tight text-[#0E1228] sm:text-[32px]">{title}</h2>
            <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-[#69718A]">{body}</p>
          </div>

          <div className="w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
