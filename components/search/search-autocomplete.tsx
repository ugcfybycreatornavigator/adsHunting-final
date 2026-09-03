"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Clock, Building2, Tag, Hash, LayoutGrid, MonitorPlay } from "lucide-react";
import type { SearchSuggestion } from "@/app/api/search/suggestions/route";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function SuggestionAvatar({ suggestion, fallbackIcon }: { suggestion: SearchSuggestion, fallbackIcon: React.ReactNode }) {
  const [failed, setFailed] = useState(false);

  if (suggestion.imageUrl && !failed) {
    return (
      <img
        src={suggestion.imageUrl}
        alt=""
        className="size-full rounded-md object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  if (suggestion.type === "brand" || suggestion.type === "advertiser") {
    const initial = suggestion.label ? suggestion.label.charAt(0).toUpperCase() : "B";
    return (
      <div className="flex size-full items-center justify-center bg-surface text-[11px] font-bold text-ink">
        {initial}
      </div>
    );
  }

  return <>{fallbackIcon}</>;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  onSelectBrand: (id: string, name: string) => void;
  onSelectCategory: (id: string, type: string, label: string) => void;
  onSubmit: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSelectBrand,
  onSelectCategory,
  onSubmit,
  onClear,
  placeholder = "Search keywords, brands, categories...",
  className
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [apiError, setApiError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedValue = useDebounce(value, 250);

  // Layout calculations for portal
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 520 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setRecent(JSON.parse(localStorage.getItem("signal-search-history") || "[]"));
    } catch {}
  }, []);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || !open) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 24;
    setCoords({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(200, Math.min(520, spaceBelow)),
    });
  }, [open]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        containerRef.current && !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Fetch suggestions
  useEffect(() => {
    if (debouncedValue.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      setApiError(false);
      return;
    }
    
    let isActive = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setApiError(false);
    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedValue.trim())}`, {
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
           throw new Error("Failed");
        }
        return res.json();
      })
      .then(data => {
        if (isActive) {
          setSuggestions(data.suggestions || []);
          setLoading(false);
          setActiveIndex(-1); // Reset keyboard navigation
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        if (isActive) {
           setLoading(false);
           setApiError(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [debouncedValue]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0) {
        // Handle selection
        if (activeIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[activeIndex]);
        } else if (activeIndex < suggestions.length + (value.trim() ? 1 : 0)) {
          // "Search all" action
          onSubmit(value.trim());
          setOpen(false);
        } else {
          // Recent searches
          const recentIndex = activeIndex - suggestions.length - (value.trim() ? 1 : 0);
          if (recent[recentIndex]) {
            onSubmit(recent[recentIndex]);
            setOpen(false);
          }
        }
      } else {
        if (value.trim()) onSubmit(value.trim());
        setOpen(false);
      }
    }
  };

  const handleSelectSuggestion = (s: SearchSuggestion) => {
    if (s.type === "brand" || s.type === "advertiser") {
      onSelectBrand(s.id, s.label);
    } else if (s.type === "category") {
      onSelectCategory(s.id, s.subtitle || "Niche", s.label);
    } else {
      onSubmit(s.label);
    }
    setOpen(false);
  };

  const clearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem("signal-search-history");
    setRecent([]);
  };

  const removeRecentItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updated = recent.filter(r => r !== item);
    localStorage.setItem("signal-search-history", JSON.stringify(updated));
    setRecent(updated);
  };

  const totalItems = suggestions.length + (value.trim() ? 1 : 0) + (!value.trim() && recent.length > 0 ? recent.length : 0);

  const getIconForType = (type: string, subtitle?: string) => {
    if (type === "brand" || type === "advertiser") return <Building2 size={15} className="text-zinc-500" />;
    if (type === "category") {
      if (subtitle === "Market") return <LayoutGrid size={15} className="text-zinc-500" />;
      if (subtitle === "Format" || subtitle === "Style") return <MonitorPlay size={15} className="text-zinc-500" />;
      return <Tag size={15} className="text-zinc-500" />;
    }
    return <Hash size={15} className="text-zinc-500" />;
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={19} />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls="search-autocomplete-listbox"
        aria-autocomplete="list"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-14 text-[15px] outline-none placeholder:text-zinc-400 focus:border-[#68B32F] focus:ring-4 focus:ring-[#68B32F]/15 transition-all shadow-sm"
        placeholder={placeholder}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {loading && <Loader2 size={14} className="animate-spin text-zinc-400" />}
        {value && (
          <button 
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }} 
            className="grid size-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-50 hover:text-ink" 
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {mounted && open && createPortal(
        <div 
          ref={dropdownRef}
          id="search-autocomplete-listbox"
          role="listbox"
          style={{ top: coords.top, left: coords.left, width: coords.width, maxHeight: coords.maxHeight }}
          className="fixed z-[100] flex flex-col overflow-y-auto rounded-[12px] border border-line bg-white shadow-lg animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300 mt-2"
        >
          {suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-xs font-semibold text-muted">Suggestions</div>
              {suggestions.map((s, idx) => (
                <div
                  key={s.id}
                  role="option"
                  aria-selected={activeIndex === idx}
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-3 py-2.5 transition",
                    activeIndex === idx ? "bg-red-50" : "hover:bg-zinc-50"
                  )}
                  onClick={() => handleSelectSuggestion(s)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface overflow-hidden">
                      <SuggestionAvatar suggestion={s} fallbackIcon={getIconForType(s.type, s.subtitle)} />
                    </div>
                    <div className="flex flex-col truncate">
                      <span className={cn("truncate text-sm font-medium", activeIndex === idx ? "text-signal" : "text-ink")}>{s.label}</span>
                      <span className="truncate text-xs text-muted">{s.subtitle || s.type}</span>
                    </div>
                  </div>
                  {s.activeAdCount != null && (
                    <span className="shrink-0 text-xs text-muted">{s.activeAdCount.toLocaleString()} ads</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {value.trim().length > 0 && (
            <div className={cn("border-t border-line py-1", suggestions.length === 0 ? "border-t-0" : "")}>
              <div
                role="option"
                aria-selected={activeIndex === suggestions.length}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-4 py-3 transition",
                  activeIndex === suggestions.length ? "bg-red-50 text-signal" : "hover:bg-zinc-50 text-ink"
                )}
                onClick={() => {
                  onSubmit(value.trim());
                  setOpen(false);
                }}
              >
                <Search size={15} className={activeIndex === suggestions.length ? "text-signal" : "text-muted"} />
                <span className="truncate text-sm font-medium">Search all ads for &quot;{value.trim()}&quot;</span>
              </div>
            </div>
          )}

          {!value.trim() && recent.length > 0 && (
            <div className="py-2">
              <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-xs font-semibold text-muted">Recent searches</span>
                <button onClick={clearRecent} className="text-[11px] font-medium text-muted hover:text-signal">Clear</button>
              </div>
              {recent.map((r, idx) => {
                const itemIndex = suggestions.length + (value.trim() ? 1 : 0) + idx;
                return (
                  <div
                    key={`recent-${r}`}
                    role="option"
                    aria-selected={activeIndex === itemIndex}
                    className={cn(
                      "group flex cursor-pointer items-center justify-between px-3 py-2.5 transition",
                      activeIndex === itemIndex ? "bg-red-50" : "hover:bg-zinc-50"
                    )}
                    onClick={() => {
                      onSubmit(r);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Clock size={15} className="text-zinc-400" />
                      <span className={cn("truncate text-sm", activeIndex === itemIndex ? "text-signal" : "text-ink")}>{r}</span>
                    </div>
                    <button
                      onClick={(e) => removeRecentItem(e, r)}
                      className="hidden p-1 text-zinc-400 hover:text-signal group-hover:block"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {value.trim().length >= 2 && suggestions.length === 0 && !loading && !apiError && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink">No matching brands found</p>
            </div>
          )}

          {value.trim().length >= 2 && apiError && !loading && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-ink">Suggestions could not be loaded.</p>
              <p className="mt-1 text-xs text-muted">You can still search all ads for &quot;{value.trim()}&quot;.</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
