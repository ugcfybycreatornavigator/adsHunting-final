"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Search, X, Clock, ArrowRight, ArrowUpRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { normalizeTerm, rankSuggestions, relatedToHistory, type SearchSuggestion } from "@/lib/search-suggestions";

type Props = {
  value: string; onChange: (value: string) => void; onSubmit: (value: string) => void;
  onSelectBrand: (suggestion: SearchSuggestion) => void;
  onSelectCategory: (id: string, type: string) => void;
  onClear: () => void; placeholder?: string; className?: string;
  history?: string[]; onHistoryChange?: (history: string[]) => void; accountKey?: string;
  embedded?: boolean;
};

function BrandAvatar({ item }: { item: SearchSuggestion }) {
  const [failed, setFailed] = useState(false);
  return item.imageUrl && !failed
    // Catalogue logos have fixed geometry and a local initial fallback.
    ? <img src={item.imageUrl} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="size-10 object-contain" onError={() => setFailed(true)} />
    : <>{item.label.slice(0, 1).toUpperCase()}</>;
}

export function SearchAutocomplete({ value, onChange, onSubmit, onSelectBrand, onSelectCategory, onClear, placeholder, className = "", history = [], onHistoryChange, accountKey = "", embedded = false }: Props) {
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [items, setItems] = useState<SearchSuggestion[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<SearchSuggestion | null>(null);
  const [height, setHeight] = useState(400);
  const cache = useRef(new Map<string, { at: number; items: SearchSuggestion[] }>());
  const query = value.trim();
  const recents = history.filter(term => normalizeTerm(term).includes(normalizeTerm(query)));
  const ranked = rankSuggestions(sourceQuery === query ? items : [], query, history, accountKey + new Date().toISOString().slice(0, 10));
  const options: SearchSuggestion[] = [
    ...recents.map(term => ({ id: "recent:" + term, type: "recent" as const, label: term, normalizedLabel: normalizeTerm(term) })),
    ...ranked.filter(item => !recents.some(term => normalizeTerm(term) === normalizeTerm(item.label))),
  ];
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const viewport = window.visualViewport;
      const bottom = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0);
      setHeight(Math.max(0, Math.min(440, bottom - (root.current?.getBoundingClientRect().bottom ?? 0) - 12)));
    };
    fit();
    window.visualViewport?.addEventListener("resize", fit);
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, true);
    return () => {
      window.visualViewport?.removeEventListener("resize", fit);
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    setActive(-1); setError(""); setItems([]); setSourceQuery(query);
    if (!open || query.length === 1) { setLoading(false); return; }
    const key = normalizeTerm(query);
    const cached = cache.current.get(key);
    if (cached && Date.now() - cached.at < 60_000 && retry === 0) { setItems(cached.items); setLoading(false); return; }
    const controller = new AbortController();
    let live = true;
    setLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch("/api/search/suggestions?q=" + encodeURIComponent(query), { signal: controller.signal });
        if (!response.ok) throw new Error("Suggestions unavailable");
        const body = await response.json();
        if (!live) return;
        const result = Array.isArray(body.suggestions) ? body.suggestions : [];
        cache.current.set(key, { at: Date.now(), items: result });
        if (cache.current.size > 30) cache.current.delete(cache.current.keys().next().value!);
        setItems(result);
      } catch {
        if (live) setError("Suggestions are unavailable. You can still search.");
      } finally {
        window.clearTimeout(timeout);
        if (live) setLoading(false);
      }
    }, query ? 150 : 0);
    return () => { live = false; controller.abort(); window.clearTimeout(timer); window.clearTimeout(timeout); };
  }, [query, open, retry]);
  useEffect(() => { if (active >= 0) document.getElementById(id + "-" + active)?.scrollIntoView({ block: "nearest" }); }, [active, id]);
  const choose = (item: SearchSuggestion) => {
    onChange(item.label); setPending(item.type === "recent" ? null : item); setOpen(false); setActive(-1); input.current?.focus();
  };
  const submit = () => {
    setOpen(false);
    if (pending && pending.label === value && pending.type === "category") onSelectCategory(pending.id, pending.subtitle || "");
    else if (pending && pending.label === value) onSelectBrand(pending);
    else onSubmit(value.trim());
  };
  return <div ref={root} className={"relative " + className} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <div className={embedded
      ? "flex min-h-14 items-center gap-2 bg-transparent px-4 sm:px-5"
      : "flex min-h-14 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 shadow-sm ring-signal/15 transition-shadow focus-within:border-signal/50 focus-within:ring-4"}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-emerald-100 bg-white text-emerald-700 shadow-sm" aria-hidden="true">
        <Search size={18} />
      </span>
      <input ref={input} role="combobox" aria-label="Search ads or brands" aria-expanded={open} aria-controls={id}
        aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? id + "-" + active : undefined}
        autoComplete="off" maxLength={160} value={value} placeholder={placeholder}
        className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-zinc-900 outline-none shadow-none ring-0 placeholder:text-zinc-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        onFocus={() => setOpen(true)}
        onChange={event => { onChange(event.target.value); setPending(null); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { setOpen(false); setActive(-1); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(current => options.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : -1);
          }
          if (event.key === "Enter") { event.preventDefault(); if (open && active >= 0 && options[active]) choose(options[active]); else submit(); }
        }} />
      {value && <button type="button" aria-label="Clear input" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100" onClick={() => { setPending(null); onClear(); input.current?.focus(); setOpen(true); }}><X size={18} /></button>}
      <button type="button" onClick={submit} aria-label="Search" className={embedded
        ? "grid size-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20"
        : "min-h-11 shrink-0 rounded-xl bg-signal px-3 text-sm font-semibold text-white hover:opacity-90 sm:px-5"}>
        {embedded ? <ArrowRight size={20} /> : "Search"}
      </button>
    </div>
    {open && <div style={{ maxHeight: height }} className="absolute inset-x-0 top-full z-50 mt-2 overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500">
        <span>Choose a suggestion, then Search</span>
        {history.length > 0 && <button type="button" className="min-h-11 px-2 text-zinc-700 hover:underline" onClick={() => onHistoryChange?.([])}>Clear history</button>}
      </div>
      <div id={id} role="listbox" aria-label="Search suggestions">
        {options.map((item, index) => <Fragment key={item.id}>
          {(index === 0 || options[index - 1].type !== item.type) && <div role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{item.type === "recent" ? "Recent searches" : item.type === "category" ? "Filters" : query ? "Brand matches" : "Discover brands"}</div>}
          <div role="presentation" className="flex items-center">
          <button type="button" id={id + "-" + index} role="option" aria-selected={active === index}
            className={"flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left " + (active === index ? "bg-zinc-100" : "hover:bg-zinc-50")}
            onPointerDown={event => event.preventDefault()} onClick={() => choose(item)}>
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-600">
              {item.type === "recent" ? <Clock size={18} /> : <BrandAvatar item={item} />}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{item.label}</span><span className="block truncate text-xs text-zinc-500">{item.type === "recent" ? "Recent search · this device" : item.type === "category" ? item.subtitle + " filter" : query ? "Brand · ad catalogue" : relatedToHistory(item.label, history) ? "Name matches your recent searches" : "Explore brands · ad catalogue"}</span></span>
            <ArrowUpRight size={16} className="shrink-0 text-zinc-400" />
          </button>
          {item.type === "recent" && <button type="button" aria-label={"Remove recent search " + item.label} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100" onClick={() => onHistoryChange?.(history.filter(term => term !== item.label))}><X size={16} /></button>}
        </div></Fragment>)}
      </div>
      <div role="status" className="px-3 py-2 text-xs text-zinc-500">
        {loading ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin motion-reduce:animate-none" />Finding catalogue brands…</span> : error ? <span>{error} <button type="button" className="min-h-11 px-2 underline" onClick={() => setRetry(count => count + 1)}>Retry</button></span> : !options.length ? query.length === 1 ? "Type another character for brand matches." : query ? "No catalogue matches. Search this keyword to discover ads." : "No catalogue suggestions available." : "Suggestions do not use research credits."}
      </div>
    </div>}
  </div>;
}
