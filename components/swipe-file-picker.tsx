"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { SwipeFile, NormalizedAd } from "@/lib/types";

export type SwipeFileResult = {
  savedAdId: string;
  collectionIds: string[];
  collectionNames: string[];
};

export function SwipeFilePicker({
  ad,
  saved,
  initialCollectionIds = [],
  anchorRef,
  onClose,
  onAdded,
}: {
  ad: NormalizedAd;
  saved?: boolean;
  initialCollectionIds?: string[];
  anchorRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onAdded?: (result: SwipeFileResult) => void;
}) {
  const [collections, setCollections] = useState<SwipeFile[]>([]);
  const [selected, setSelected] = useState<string[]>(initialCollectionIds);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    let active = true;
    setLoading(true);
    apiFetch("/api/swipe-files")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load Swipe Files.");
        if (active) setCollections(Array.isArray(data) ? data.filter((c: SwipeFile) => !c.isSystem) : []);
      })
      .catch(() => active && setError("Couldn't load your Swipe Files. Try again."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!anchorRef?.current || window.innerWidth < 640) return; // Mobile uses sheet
    
    const updatePosition = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      const popoverHeight = 360; // Max height approx
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top: number | undefined = undefined;
      let bottom: number | undefined = undefined;
      
      if (spaceBelow >= popoverHeight || spaceBelow > spaceAbove) {
        top = rect.bottom + 8;
      } else {
        bottom = window.innerHeight - rect.top + 8;
      }
      
      setPosition({
        top,
        bottom,
        left: rect.left,
        width: rect.width,
      });
    };
    
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        // Also don't close if clicking the anchor
        if (anchorRef?.current && anchorRef.current.contains(event.target as Node)) return;
        onClose();
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, anchorRef]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return collections;
    return collections.filter((collection) => collection.name.toLowerCase().includes(term));
  }, [collections, query]);

  async function createAndAdd() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/swipe-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const collection: SwipeFile = {
        id: data.collection.id,
        name: data.collection.name,
        description: data.collection.description,
        isSystem: false,
        systemKey: null,
        createdAt: data.collection.created_at,
        updatedAt: data.collection.updated_at,
        adCount: data.collection.adCount ?? 0,
      };
      setCollections((current) => [collection, ...current]);
      
      // Optimistic selection
      const newSelected = [...new Set([...selected, collection.id])];
      setSelected(newSelected);
      setName("");
      setCreating(false);
      
      await addToSwipeFiles(newSelected, [collection.name]);
    } catch {
      setError("Couldn't create that Swipe File. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addToSwipeFiles(ids = selected, names?: string[], justToggledId?: string) {
    if (!justToggledId) return; // we now do individual toggles
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/swipe-files/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalAdId: ad.externalId || ad.id, swipeFileId: justToggledId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      const collectionNames = names ?? collections.filter((collection) => ids.includes(collection.id)).map((collection) => collection.name);
      onAdded?.({ savedAdId: data.savedAdId || ad.id, collectionIds: ids, collectionNames });
    } catch {
      setError("Couldn't add this ad to a Swipe File. Try again.");
      setSelected(initialCollectionIds);
    } finally {
      setBusy(false);
    }
  }

  const toggleSelection = async (collectionId: string, collectionName: string) => {
    const isChecked = selected.includes(collectionId);
    let newSelected;
    if (isChecked) {
      newSelected = selected.filter(id => id !== collectionId);
    } else {
      newSelected = [...selected, collectionId];
    }
    
    // Optimistic UI update
    setSelected(newSelected);
    
    // Auto-save on toggle for a smoother experience
    await addToSwipeFiles(newSelected, [collectionName], collectionId);
  };

  const content = (
    <div 
      ref={popoverRef}
      className="flex w-full flex-col bg-white shadow-xl sm:rounded-xl sm:border border-line overflow-hidden max-h-[85vh] sm:max-h-[380px]"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">Save to Swipe File</h2>
        </div>
        <button type="button" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-zinc-50" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 p-2 border-b border-line">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search folders..."
              className="h-8 w-full rounded-md border border-transparent bg-zinc-50 pl-8 pr-3 text-xs outline-none transition focus:border-line focus:bg-white focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col gap-1">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-zinc-50" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {/* Pinned Default Folder */}
              {(!query || "saved ads".includes(query.trim().toLowerCase())) && (
                <div className="flex min-h-10 items-center gap-2.5 rounded-md px-2 opacity-80 cursor-default">
                  <div className="relative flex size-4 items-center justify-center">
                    <input type="checkbox" className="peer size-4 appearance-none rounded-[4px] border border-zinc-300 bg-white checked:border-signal checked:bg-signal transition" checked={saved} readOnly />
                    <Check size={12} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                  </div>
                  <span className="min-w-0 flex-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink">Saved Ads</span>
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Default</span>
                  </span>
                </div>
              )}
              {filtered.length > 0 && <div className="my-1.5 h-px bg-line" />}
              {filtered.map((collection) => {
                const checked = selected.includes(collection.id);
                return (
                  <label key={collection.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 transition hover:bg-zinc-50">
                    <div className="relative flex size-4 items-center justify-center">
                      <input
                        type="checkbox"
                        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-zinc-300 bg-white checked:border-signal checked:bg-signal transition"
                        checked={checked}
                        onChange={() => toggleSelection(collection.id, collection.name)}
                      />
                      <Check size={12} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                    </div>
                    <span className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-ink">{collection.name}</span>
                      <span className="text-[10px] font-medium text-muted">{collection.adCount ?? 0}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {!loading && filtered.length === 0 && query && "saved ads".indexOf(query.trim().toLowerCase()) === -1 && (
            <div className="py-6 text-center text-[13px] text-muted">No matching folders</div>
          )}
        </div>

        <div className="shrink-0 border-t border-line p-2">
          {creating ? (
            <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-2">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && createAndAdd()}
                placeholder="Folder name"
                className="h-8 w-full rounded-md border border-line px-2.5 text-xs outline-none focus:border-brand"
              />
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" className="h-7 px-2.5 py-0 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
                <Button variant="signal" className="h-7 px-2.5 py-0 text-xs" onClick={createAndAdd} disabled={busy || !name.trim()}>
                  {busy ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-ink hover:bg-zinc-50 transition">
              <Plus size={15} className="text-zinc-400" />
              Create new folder
            </button>
          )}
          {error && <p className="mt-2 text-[11px] text-red-500 font-medium px-1">{error}</p>}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  // Render differently for mobile vs desktop
  return createPortal(
    <>
      <div className="sm:hidden fixed inset-0 z-[70] flex flex-col justify-end bg-black/40 p-0" role="dialog" aria-modal="true" aria-label="Add to Swipe File" onMouseDown={onClose}>
        <div className="w-full rounded-t-2xl bg-white max-h-[85vh] flex flex-col" onMouseDown={(event) => event.stopPropagation()}>
          <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-zinc-200" />
          {content}
        </div>
      </div>
      
      <div className="hidden sm:block absolute z-[70]" style={position ? {
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        minWidth: 260
      } : { visibility: 'hidden' }}>
        {content}
      </div>
    </>,
    document.body
  );
}
