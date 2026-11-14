'use client';

import Script from "next/script";

export function ContactForm() {
  return (
    <div className="w-full max-w-[720px] mx-auto relative px-3 sm:px-4 md:px-0 [&_.deftform]:!w-full [&_.deftform]:max-w-full [&_iframe]:!w-full [&_iframe]:!max-w-full [&_iframe]:border-0 [&_iframe]:block">
      <div
        className="deftform"
        data-form-id="i6kFai"
        data-form-width="100%"
        data-form-align="center"
        data-form-auto-height="1"
      />

      <Script
        src="https://cdn.deftform.com/embed.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
