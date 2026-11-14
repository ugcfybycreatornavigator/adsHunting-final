"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { AdSearchFilters } from "@/lib/types";
import { Popover } from "./ui-primitives";
import { Bookmark, ChevronDown } from "lucide-react";

export function SavedFiltersPopover({ filters, updateFilters }: { filters: AdSearchFilters; updateFilters: (filters: AdSearchFilters) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      header={<div className="font-semibold text-ink text-[15px] pb-3 border-b border-line mb-3">Saved Filters</div>}
      footer={null}
      trigger={
        <Button variant="secondary" className="h-10 rounded-full border-zinc-200 bg-white px-3.5 text-[13px] font-semibold text-zinc-700 shadow-none hover:bg-zinc-50">
          <Bookmark size={14} className="mr-1.5 text-zinc-400" />
          Saved Filters
          <ChevronDown size={14} className="ml-1 text-zinc-400" />
        </Button>
      }
    >
      <div className="w-[280px]">
        <SavedFilters currentFilters={filters} onApply={(f) => { updateFilters(f); setOpen(false); }} />
      </div>
    </Popover>
  );
}

export function SavedFilters({
  currentFilters,
  onApply,
}: {
  currentFilters: AdSearchFilters;
  onApply: (filters: AdSearchFilters) => void;
}) {
  const [saved, setSaved] = useState<{ id: string; name: string; filters: AdSearchFilters }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/saved-filters")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSaved(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const hasAnyFiltersApplied = () => {
    return [
      ...(currentFilters.formats || []),
      ...(currentFilters.statuses || []),
      ...(currentFilters.markets || []),
      ...(currentFilters.languages || []),
      ...(currentFilters.niches || []),
      ...(currentFilters.contentStyles || []),
    ].length > 0 || !!currentFilters.runtime || !!currentFilters.videoLength;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          filters: currentFilters,
        }),
      });
      if (res.ok) {
        const newFilter = await res.json();
        setSaved([newFilter, ...saved]);
        setName("");
        setShowForm(false);
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setSaved(saved.filter((s) => s.id !== id));
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-muted">
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {saved.length > 0 ? (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300">
          {saved.map((s) => (
            <div key={s.id} className="group flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm transition hover:border-signal hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-signal">
              <button
                className="flex-1 text-left font-medium text-ink focus:outline-none"
                onClick={() => onApply(s.filters)}
              >
                {s.name}
              </button>
              <button
                className="hidden text-zinc-400 hover:text-signal focus:text-signal focus:outline-none group-hover:block"
                onClick={() => handleDelete(s.id)}
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No saved filters yet.</p>
      )}

      {showForm ? (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 animate-in fade-in slide-in-from-top-1">
          <input
            type="text"
            placeholder="Filter name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-md border border-line px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="signal" className="h-8 flex-1 text-xs" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </Button>
            <Button variant="secondary" className="h-8 flex-1 text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-1 h-8 w-full text-xs"
          onClick={() => setShowForm(true)}
          disabled={!hasAnyFiltersApplied()}
          title={!hasAnyFiltersApplied() ? "Select at least one filter to save" : "Save current filters"}
        >
          <Plus size={14} className="mr-1" /> Save current view
        </Button>
      )}
    </div>
  );
}
