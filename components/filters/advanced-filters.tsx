"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdSearchFilters } from "@/lib/types";
import { NICHES, LANGUAGES, MARKETS, CONTENT_STYLES } from "@/lib/taxonomy";
import { Popover, Sheet, CheckboxItem, CollapsibleSection, SelectButtonGroup, SearchInput } from "./ui-primitives";
import { getActiveFilterCount } from "@/lib/filter-utils";
import { Button } from "@/components/ui";
import { Filter, ChevronDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdvancedFiltersProps {
  filters: AdSearchFilters;
  updateFilters: (updates: Partial<AdSearchFilters>) => void;
  clearFilters: () => void;
}

export function AdvancedFilters({ filters, updateFilters }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdSearchFilters>(filters);
  const [applying, setApplying] = useState(false);

  // Search states
  const [marketSearch, setMarketSearch] = useState("");
  const [langSearch, setLangSearch] = useState("");
  const [nicheSearch, setNicheSearch] = useState("");
  const [styleSearch, setStyleSearch] = useState("");

  // Sync draft when opened
  useEffect(() => {
    if (open) {
      setDraftFilters(filters);
      setMarketSearch("");
      setLangSearch("");
      setNicheSearch("");
      setStyleSearch("");
    }
  }, [open, filters]);

  const activeFilterCount = getActiveFilterCount(filters);
  const draftCount = getActiveFilterCount(draftFilters);

  const handleApply = () => {
    setApplying(true);
    // Mimic slight delay for network stability or directly apply
    updateFilters(draftFilters);
    setTimeout(() => {
      setApplying(false);
      setOpen(false);
    }, 150); // Give time for UI feedback
  };



  const handleArrayToggle = (key: keyof AdSearchFilters, value: string) => {
    const current = (draftFilters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setDraftFilters({ ...draftFilters, [key]: updated });
  };



  // Filtered lists based on search
  const filteredMarkets = useMemo(() => {
    if (!marketSearch) return MARKETS;
    return MARKETS.filter(m => m.label.toLowerCase().includes(marketSearch.toLowerCase()));
  }, [marketSearch]);

  const filteredLangs = useMemo(() => {
    if (!langSearch) return LANGUAGES;
    return LANGUAGES.filter(l => l.label.toLowerCase().includes(langSearch.toLowerCase()) || l.code.toLowerCase().includes(langSearch.toLowerCase()));
  }, [langSearch]);

  const filteredNiches = useMemo(() => {
    if (!nicheSearch) return NICHES;
    return NICHES.filter(n => n.label.toLowerCase().includes(nicheSearch.toLowerCase()));
  }, [nicheSearch]);

  const filteredStyles = useMemo(() => {
    if (!styleSearch) return CONTENT_STYLES;
    return CONTENT_STYLES.filter(s => s.label.toLowerCase().includes(styleSearch.toLowerCase()));
  }, [styleSearch]);

  const Header = (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold tracking-tight text-ink">Filters</h2>
        {draftCount > 0 && (
          <p className="text-[13px] font-medium text-brand mt-0.5">
            {draftCount} filter{draftCount === 1 ? "" : "s"} applied
          </p>
        )}
      </div>
      <button 
        onClick={() => setOpen(false)} 
        className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
      >
        <X size={20} />
      </button>
    </div>
  );

  const Footer = (
    <div className="flex items-center justify-between gap-3">
      <Button 
        variant="ghost" 
        className="text-[13px] font-semibold text-muted hover:text-ink hover:bg-surface flex-1 sm:flex-none justify-center" 
        onClick={() => setDraftFilters({})}
      >
        Clear all
      </Button>
      <Button 
        variant="primary" 
        className="flex-1 sm:flex-none bg-brand hover:bg-brand-hover text-white px-8 font-semibold text-sm h-11" 
        onClick={handleApply} 
        disabled={applying}
      >
        {applying ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
        Apply filters
      </Button>
    </div>
  );

  const filterContent = (
    <div className="flex flex-col gap-0 pb-4">
      


      <CollapsibleSection 
        title="Runtime" 
        selectedCount={draftFilters.runtime ? 1 : 0}
        summary={draftFilters.runtime ? `${draftFilters.runtime.minDays || 0} - ${draftFilters.runtime.maxDays || '+'} days` : "Any runtime"}
      >
        <div className="flex flex-col gap-3 pt-1">
          <SelectButtonGroup
            options={[
              { id: "today", label: "Started today" },
              { id: "1-3", label: "1–3 days" },
              { id: "4-7", label: "4–7 days" },
              { id: "8-14", label: "8–14 days" },
              { id: "15-30", label: "15–30 days" },
              { id: "31-90", label: "31–90 days" },
              { id: "90+", label: "90+ days" },
            ]}
            value={
              draftFilters.runtime?.minDays === 0 && draftFilters.runtime?.maxDays === 0 ? "today" :
              draftFilters.runtime?.minDays === 1 && draftFilters.runtime?.maxDays === 3 ? "1-3" :
              draftFilters.runtime?.minDays === 4 && draftFilters.runtime?.maxDays === 7 ? "4-7" :
              draftFilters.runtime?.minDays === 8 && draftFilters.runtime?.maxDays === 14 ? "8-14" :
              draftFilters.runtime?.minDays === 15 && draftFilters.runtime?.maxDays === 30 ? "15-30" :
              draftFilters.runtime?.minDays === 31 && draftFilters.runtime?.maxDays === 90 ? "31-90" :
              draftFilters.runtime?.minDays === 91 ? "90+" : undefined
            }
            onChange={(val) => {
              if (val === "today") setDraftFilters({ ...draftFilters, runtime: { minDays: 0, maxDays: 0 } });
              else if (val === "1-3") setDraftFilters({ ...draftFilters, runtime: { minDays: 1, maxDays: 3 } });
              else if (val === "4-7") setDraftFilters({ ...draftFilters, runtime: { minDays: 4, maxDays: 7 } });
              else if (val === "8-14") setDraftFilters({ ...draftFilters, runtime: { minDays: 8, maxDays: 14 } });
              else if (val === "15-30") setDraftFilters({ ...draftFilters, runtime: { minDays: 15, maxDays: 30 } });
              else if (val === "31-90") setDraftFilters({ ...draftFilters, runtime: { minDays: 31, maxDays: 90 } });
              else if (val === "90+") setDraftFilters({ ...draftFilters, runtime: { minDays: 91 } });
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Min days"
              value={draftFilters.runtime?.minDays ?? ""}
              onChange={(e) => setDraftFilters({ ...draftFilters, runtime: { ...draftFilters.runtime, minDays: e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined } })}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-muted">to</span>
            <input
              type="number"
              min="0"
              placeholder="Max days"
              value={draftFilters.runtime?.maxDays ?? ""}
              onChange={(e) => setDraftFilters({ ...draftFilters, runtime: { ...draftFilters.runtime, maxDays: e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined } })}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Format" 
        selectedCount={draftFilters.formats?.length || 0}
        summary={draftFilters.formats?.join(", ") || "Any format"}
      >
        <SelectButtonGroup
          options={[
            { id: "image", label: "Image" },
            { id: "video", label: "Video" },
            { id: "carousel", label: "Carousel" },
          ]}
          value={draftFilters.formats}
          onChange={(val) => handleArrayToggle("formats", val)}
        />
      </CollapsibleSection>

      <CollapsibleSection 
        title="Status"
        selectedCount={draftFilters.statuses?.length || 0}
        summary={draftFilters.statuses?.join(", ") || "Active & Inactive"}
      >
        <SelectButtonGroup
          options={[
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ]}
          value={draftFilters.statuses}
          onChange={(val) => handleArrayToggle("statuses", val)}
        />
      </CollapsibleSection>

      <CollapsibleSection 
        title="Niches" 
        selectedCount={draftFilters.niches?.length || 0}
        summary={draftFilters.niches?.length ? `${draftFilters.niches.slice(0, 2).map(id => NICHES.find(n => n.id === id)?.label || id).join(', ')}${draftFilters.niches.length > 2 ? ` + ${draftFilters.niches.length - 2}` : ''}` : "Any niche"}
      >
        <SearchInput value={nicheSearch} onChange={setNicheSearch} placeholder="Search niches..." />
        <div className="max-h-56 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {filteredNiches.map((n) => (
            <CheckboxItem
              key={n.id}
              label={n.label}
              checked={draftFilters.niches?.includes(n.id) || false}
              onChange={() => handleArrayToggle("niches", n.id)}
            />
          ))}
          {filteredNiches.length === 0 && (
            <p className="text-sm text-muted p-2">No niches found.</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Languages"
        selectedCount={draftFilters.languages?.length || 0}
        summary={draftFilters.languages?.length ? `${draftFilters.languages.slice(0, 2).map(id => LANGUAGES.find(n => n.code === id)?.label || id).join(', ')}${draftFilters.languages.length > 2 ? ` + ${draftFilters.languages.length - 2}` : ''}` : "Any language"}
      >
        <SearchInput value={langSearch} onChange={setLangSearch} placeholder="Search languages..." />
        <div className="max-h-56 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {filteredLangs.map((l) => (
            <CheckboxItem
              key={l.code}
              label={l.label}
              checked={draftFilters.languages?.includes(l.code) || false}
              onChange={() => handleArrayToggle("languages", l.code)}
            />
          ))}
          {filteredLangs.length === 0 && (
            <p className="text-sm text-muted p-2">No languages found.</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Content Style"
        selectedCount={draftFilters.contentStyles?.length || 0}
        summary={draftFilters.contentStyles?.length ? `${draftFilters.contentStyles.slice(0, 2).map(id => CONTENT_STYLES.find(n => n.id === id)?.label || id).join(', ')}${draftFilters.contentStyles.length > 2 ? ` + ${draftFilters.contentStyles.length - 2}` : ''}` : "Any style"}
      >
        <SearchInput value={styleSearch} onChange={setStyleSearch} placeholder="Search styles..." />
        <div className="max-h-56 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {filteredStyles.map((cs) => (
            <CheckboxItem
              key={cs.id}
              label={cs.label}
              checked={draftFilters.contentStyles?.includes(cs.id) || false}
              onChange={() => handleArrayToggle("contentStyles", cs.id)}
            />
          ))}
          {filteredStyles.length === 0 && (
            <p className="text-sm text-muted p-2">No styles found.</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Observed Markets"
        selectedCount={draftFilters.markets?.length || 0}
        summary={draftFilters.markets?.length ? `${draftFilters.markets.slice(0, 2).map(id => MARKETS.find(n => n.code === id)?.label || id).join(', ')}${draftFilters.markets.length > 2 ? ` + ${draftFilters.markets.length - 2}` : ''}` : "Any market"}
      >
        <SearchInput value={marketSearch} onChange={setMarketSearch} placeholder="Search markets..." />
        <div className="max-h-56 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {filteredMarkets.map((m) => (
            <CheckboxItem
              key={m.code}
              label={m.label}
              checked={draftFilters.markets?.includes(m.code) || false}
              onChange={() => handleArrayToggle("markets", m.code)}
            />
          ))}
          {filteredMarkets.length === 0 && (
            <p className="text-sm text-muted p-2">No markets found.</p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Video Length"
        selectedCount={draftFilters.videoLength ? 1 : 0}
        summary={draftFilters.videoLength ? `${draftFilters.videoLength.minSeconds || 0} - ${draftFilters.videoLength.maxSeconds || '+'}s` : "Any length"}
      >
        <div className="flex flex-col gap-3 pt-1">
          <SelectButtonGroup
            options={[
              { id: "0-6", label: "Under 6s" },
              { id: "6-15", label: "6–15s" },
              { id: "16-30", label: "16–30s" },
              { id: "31-60", label: "31–60s" },
              { id: "61-90", label: "61–90s" },
              { id: "91+", label: "Over 90s" },
            ]}
            value={
              draftFilters.videoLength?.minSeconds === 0 && draftFilters.videoLength?.maxSeconds === 6 ? "0-6" :
              draftFilters.videoLength?.minSeconds === 6 && draftFilters.videoLength?.maxSeconds === 15 ? "6-15" :
              draftFilters.videoLength?.minSeconds === 16 && draftFilters.videoLength?.maxSeconds === 30 ? "16-30" :
              draftFilters.videoLength?.minSeconds === 31 && draftFilters.videoLength?.maxSeconds === 60 ? "31-60" :
              draftFilters.videoLength?.minSeconds === 61 && draftFilters.videoLength?.maxSeconds === 90 ? "61-90" :
              draftFilters.videoLength?.minSeconds === 91 ? "91+" : undefined
            }
            onChange={(val) => {
              if (val === "0-6") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 0, maxSeconds: 6 } });
              else if (val === "6-15") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 6, maxSeconds: 15 } });
              else if (val === "16-30") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 16, maxSeconds: 30 } });
              else if (val === "31-60") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 31, maxSeconds: 60 } });
              else if (val === "61-90") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 61, maxSeconds: 90 } });
              else if (val === "91+") setDraftFilters({ ...draftFilters, videoLength: { minSeconds: 91 } });
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Min sec"
              value={draftFilters.videoLength?.minSeconds ?? ""}
              onChange={(e) => setDraftFilters({ ...draftFilters, videoLength: { ...draftFilters.videoLength, minSeconds: e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined } })}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="text-muted">to</span>
            <input
              type="number"
              min="0"
              placeholder="Max sec"
              value={draftFilters.videoLength?.maxSeconds ?? ""}
              onChange={(e) => setDraftFilters({ ...draftFilters, videoLength: { ...draftFilters.videoLength, maxSeconds: e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined } })}
              className="h-9 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
      </CollapsibleSection>

    </div>
  );

  return (
    <>
      <div className="hidden sm:block">
        <Popover
          open={open}
          onOpenChange={setOpen}
          header={Header}
          footer={Footer}
          trigger={
            <Button variant="secondary" className={cn("h-10 rounded-full px-3.5 text-[13px] font-semibold shadow-none transition", activeFilterCount > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")}>
              <Filter size={15} className={cn("mr-1.5", activeFilterCount > 0 ? "text-[#68B32F]" : "text-zinc-500")} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 grid min-w-[20px] place-items-center rounded bg-[#68B32F]/15 px-1 text-[11px] font-bold text-[#559922]">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={14} className="ml-1.5 text-zinc-400" />
            </Button>
          }
        >
          {filterContent}
        </Popover>
      </div>

      <div className="block sm:hidden">
        <Button variant="secondary" className={cn("h-9 text-[13px] font-semibold px-3 shadow-sm transition w-full justify-center", activeFilterCount > 0 ? "bg-[#68B32F]/5 border-[#68B32F]/30 text-ink" : "bg-white border-line hover:bg-zinc-50 text-ink")} onClick={() => setOpen(true)}>
          <Filter size={15} className={cn("mr-1.5", activeFilterCount > 0 ? "text-[#68B32F]" : "text-zinc-500")} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1.5 grid min-w-[20px] place-items-center rounded bg-[#68B32F]/15 px-1 text-[11px] font-bold text-[#559922]">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <Sheet 
          open={open} 
          onClose={() => setOpen(false)}
          header={Header}
          footer={Footer}
        >
          {filterContent}
        </Sheet>
      </div>
    </>
  );
}
