'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import { authLinks } from '@/data/landing/config';

const PLACEHOLDERS = [
  "Search brands, ads or competitors...",
  "e.g. 'Aether Athletics'",
  "e.g. 'Nike running shoes'",
  "e.g. 'Beauty campaigns 2026'",
];

export function HeroProductPreview() {
  const [searchValue, setSearchValue] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const router = useRouter();

  /* ── Typewriter placeholder effect (preserved from original) ── */
  useEffect(() => {
    let currentPlaceholderIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const type = () => {
      const currentFullText = PLACEHOLDERS[currentPlaceholderIndex];

      if (isDeleting) {
        setPlaceholderText(currentFullText.substring(0, currentCharIndex - 1));
        currentCharIndex--;
      } else {
        setPlaceholderText(currentFullText.substring(0, currentCharIndex + 1));
        currentCharIndex++;
      }

      let typingSpeed = isDeleting ? 30 : 70;

      if (!isDeleting && currentCharIndex === currentFullText.length) {
        typingSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false;
        currentPlaceholderIndex = (currentPlaceholderIndex + 1) % PLACEHOLDERS.length;
        typingSpeed = 500;
      }

      timeoutId = setTimeout(type, typingSpeed);
    };

    timeoutId = setTimeout(type, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;

    setIsRedirecting(true);
    setTimeout(() => {
      router.push(`${authLinks.signUp}?search=${encodeURIComponent(searchValue)}`);
    }, 1200);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto relative">
      {/* Decorative glow behind the shell */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(94,169,32,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Search form with premium glass shell */}
      <form
        onSubmit={handleSearch}
        className="mx-auto w-full max-w-[680px] flex items-center p-2 md:p-3 h-[72px] md:h-[88px] relative z-20 transition-all duration-300"
        style={{
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(10,10,10,0.08)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04), 0 20px 80px rgba(0,0,0,0.06)',
        }}
      >
        <div className="pl-4 md:pl-6 pr-2 flex items-center justify-center">
          <Search className="text-[#52525B]/60" size={24} strokeWidth={1.75} />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={placeholderText || "Search brands, ads or competitors..."}
          className="flex-1 h-full min-w-0 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[17px] md:text-[20px] text-[#0A0A0A] font-medium placeholder:text-[#52525B]/50 placeholder:font-normal px-2"
          disabled={isRedirecting}
        />
        <button
          type="submit"
          disabled={isRedirecting || !searchValue.trim()}
          className="group ml-2 h-full px-6 md:px-8 flex items-center justify-center flex-shrink-0 text-[15px] md:text-[17px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          style={{
            borderRadius: '14px',
            background: '#68B32F',
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.background = '#4F9223';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#68B32F';
          }}
        >
          {isRedirecting ? (
            <>
              <Loader2 size={20} className="animate-spin md:mr-2" />
              <span className="hidden md:inline">Redirecting...</span>
            </>
          ) : (
            <>
              <span className="mr-2">Search</span>
              <ArrowRight size={20} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-[3px]" />
            </>
          )}
        </button>
      </form>

      {isRedirecting && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[15px] font-semibold" style={{ color: '#68B32F' }}>
            Preparing your search results...
          </p>
          <p className="text-[13px] text-[#52525B] max-w-[400px] text-center">
            Create a free account to view full competitor analysis and creative details.
          </p>
        </div>
      )}
    </div>
  );
}
