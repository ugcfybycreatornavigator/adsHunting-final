"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useSwipeFiles } from "@/hooks/use-swipe-files";
import type { SwipeFile } from "@/lib/types";
import { useRouter } from "next/navigation";

export function CreateSwipeFileModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { mutate } = useSwipeFiles();
  const router = useRouter();

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/swipe-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Unable to create swipe file");
      }
      
      await mutate(async (currentData: SwipeFile[] | undefined) => {
        return currentData ? [...currentData, data.collection] : [data.collection];
      }, { revalidate: true });
      
      if (onCreated) {
        onCreated(data.collection.id);
      } else {
        router.push(`/swipe-files/${data.collection.id}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-black/25 p-0 sm:place-items-center sm:p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Create swipe file" onMouseDown={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Create Swipe File</h2>
          </div>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-lg hover:bg-surface transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. High Performing Ads"
            className="h-11 w-full rounded-lg border border-line px-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-shadow"
            disabled={busy}
          />
          
          {error && <p className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-signal">{error}</p>}
          
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
