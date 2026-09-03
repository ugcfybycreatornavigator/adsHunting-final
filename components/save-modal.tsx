"use client";

import { useState } from "react";
import { Check, FolderPlus, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { NormalizedAd } from "@/lib/types";
import { useSwipeFiles } from "@/hooks/use-swipe-files";
import { ModalShell } from "@/components/modal-shell";
import { Bookmark } from "lucide-react";

export function SaveModal({ ad, onClose }: { ad: NormalizedAd; onClose: () => void }) {
  const { data: collections, mutate } = useSwipeFiles();
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function createAndSelect() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/swipe-files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error);
    const collection = { ...data.collection, createdAt: data.collection.created_at, updatedAt: data.collection.updated_at };
    mutate();
    setSelected(current => [...current, collection.id]);
    setName("");
    setCreating(false);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const defaultResponse = await fetch("/api/swipe-files/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adId: ad.id, externalAdId: ad.externalId || ad.id }) });
      const defaultData = await defaultResponse.json();
      if (!defaultResponse.ok) throw new Error(defaultData.error || "Unable to save this ad.");
      await Promise.all(selected.map(async swipeFileId => {
        const response = await fetch("/api/swipe-files/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adId: ad.id, externalAdId: ad.externalId || ad.id, swipeFileId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save this ad.");
      }));
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this ad.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Save to Swipe File"
      description="Choose one or more folders for this creative."
      headerIcon={<Bookmark size={18} />}
    >
      <div className="p-5 sm:p-6">
        {done ? (
          <div className="my-10 flex flex-col items-center text-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-green-50 text-green-600">
              <Check size={22} />
            </span>
            <p className="font-semibold text-zinc-900">Saved to your swipe file</p>
          </div>
        ) : (
          <>
            <div className="max-h-60 space-y-2 overflow-auto">
              {collections?.map(collection => {
                const checked = selected.includes(collection.id);
                return (
                  <label key={collection.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-zinc-100 px-3 hover:bg-zinc-50 transition-colors">
                    <input type="checkbox" className="accent-brand" checked={checked} onChange={() => setSelected(current => checked ? current.filter(id => id !== collection.id) : [...current, collection.id])} />
                    <span className="flex-1 text-sm font-medium text-zinc-800">{collection.name}</span>
                    <span className="text-xs text-zinc-400">{collection.adCount ?? 0}</span>
                  </label>
                );
              })}
              {!collections?.length && !error && (
                <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">No folders yet. Create your first one below.</p>
              )}
            </div>

            {creating ? (
              <div className="mt-3 flex gap-2">
                <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && createAndSelect()} placeholder="High Performing Ads" className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition" />
                <Button variant="secondary" onClick={createAndSelect} disabled={busy || !name.trim()}>Create</Button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand hover:bg-brand/10 transition-colors">
                <FolderPlus size={17} />Create folder
              </button>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-signal">{error}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={save} disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Save ad
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
