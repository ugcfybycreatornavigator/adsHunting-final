"use client";
import { apiFetch } from "@/lib/api-client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkX, Check, Folder, Loader2, Search, Tag, X, StickyNote } from "lucide-react";
import { AdCard } from "@/components/ad-card";
import { AdDetailDrawer } from "@/components/ad-detail";
import { EmptyState, Button, Skeleton } from "@/components/ui";
import { ShareModal } from "@/components/share-modal";
import { ModalShell } from "@/components/modal-shell";
import type { SwipeFile, NormalizedAd } from "@/lib/types";

type Saved = { id: string; notes: string | null; createdAt: string; ad: NormalizedAd; tags: { id: string; name: string }[]; collectionIds: string[] };

export function SavedAdsView({ collectionId }: { collectionId?: string }) {
  const [items, setItems] = useState<Saved[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [details, setDetails] = useState<NormalizedAd | null>(null); const [editing, setEditing] = useState<Saved | null>(null); const [toast, setToast] = useState<string | null>(null); const [shareAdId, setShareAdId] = useState<string | null>(null); const [shareCollection] = useState<boolean>(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await apiFetch(`/api/swipe-files/ads${collectionId ? `?swipeFileId=${collectionId}` : ""}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setItems(Array.isArray(data.items) ? data.items : []); } catch (error) { setItems([]); setError(error instanceof Error ? error.message : "Unable to load saved ads."); } finally { setLoading(false); } }, [collectionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2400); return () => window.clearTimeout(timer); }, [toast]);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return items; return items.filter(item => [item.ad?.advertiser?.name,item.ad?.copy?.headline,item.ad?.copy?.primaryText,item.notes,...(item.tags || []).map((t: { id: string; name: string }) => t.name)].some(value => typeof value === "string" && value.toLowerCase().includes(q))); }, [items, query]);
  async function remove(id: string) { if (!confirm("Remove this creative from Saved Ads?")) return; const response = await apiFetch(`/api/swipe-files/ads?id=${id}`, { method: "DELETE" }); if (response.ok) setItems(current => current.filter(item => item.id !== id)); }
  async function share(ad: NormalizedAd) { setShareAdId(ad.id); }
  if (loading) return <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),340px))] gap-4">{Array.from({length:6}).map((_,i)=><div key={i} className="flex flex-col w-full overflow-hidden rounded-[12px] border border-line bg-white shadow-sm"><div className="flex h-[52px] items-center gap-2.5 px-3"><Skeleton className="size-7 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div></div><Skeleton className="w-full aspect-[4/5] rounded-none" /><div className="flex w-full min-h-[44px] border-b border-line items-center px-3"><Skeleton className="h-4 w-12" /></div><div className="flex flex-col border-t border-line px-3 py-3 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div><div className="flex w-full min-h-[44px] border-t border-line items-center px-2 gap-2"><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="size-8 rounded-md shrink-0" /></div></div>)}</div>;
  if (error) return <EmptyState icon={<BookmarkX />} title="Saved ads unavailable" body={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />;
  return <div className="flex h-full flex-col p-4 md:p-8 max-w-[1600px] mx-auto w-full">
    {!collectionId && (
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Saved Ads</h1>
        <p className="mt-1 text-sm text-muted">Review and organize your saved creative references.</p>
      </div>
    )}
    <div className="relative mb-6 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search saved ads…" className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none focus:border-brand" />
    </div>
    {!filtered.length && <EmptyState icon={<BookmarkX />} title="No saved ads" body="Save creatives from the Discover tab to review them here." />}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),340px))] gap-4">
      {filtered.map(item => (
        <AdCard key={item.id} ad={item.ad} saved tags={item.tags} onOpen={() => setDetails(item.ad)} onSave={() => {}} onNoteClick={() => setEditing(item)} onRemoveClick={() => remove(item.id)} onShare={() => share(item.ad)} />
      ))}
    </div>
    {details && <AdDetailDrawer ad={details} onClose={() => setDetails(null)} />}
    {editing && (
      <EditModal
        item={editing}
        onClose={() => setEditing(null)}
        onChange={updated => setItems(current => current.map(i => i.id === updated.id ? updated : i))}
      />
    )}
    {shareAdId && (
      <ShareModal
        isOpen={true}
        onClose={() => setShareAdId(null)}
        adIds={shareCollection && collectionId ? [] : [shareAdId]}
        swipeFileId={shareCollection && collectionId ? collectionId : undefined}
      />
    )}
    {toast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
        {toast}
      </div>
    )}
  </div>;
}

function EditModal({ item, onClose, onChange }: { item: Saved; onClose: () => void; onChange: (updated: Saved) => void }) {
  const [notes, setNotes] = useState(item.notes || "");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [collections, setCollections] = useState<SwipeFile[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>(item.collectionIds || []);

  useEffect(() => {
    apiFetch("/api/swipe-files").then(r => r.json()).then((d: { collections?: SwipeFile[] }) => { if (Array.isArray(d.collections)) setCollections(d.collections); });
  }, []);

  async function saveNotes() { setBusy(true); const response = await apiFetch("/api/swipe-files/ads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, notes }) }); const data = await response.json(); setBusy(false); if (!response.ok) return setError(data.error); onChange({ ...item, notes }); }
  async function saveCollections() { setBusy(true); setError(""); const response = await apiFetch("/api/swipe-files/ads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, collectionIds }) }); const data = await response.json(); setBusy(false); if (!response.ok) return setError(data.error); onChange({ ...item, collectionIds }); }
  async function addTag(event: FormEvent) { event.preventDefault(); if (!tag.trim()) return; setBusy(true); const response = await apiFetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedAdId: item.id, name: tag }) }); const data = await response.json(); setBusy(false); if (!response.ok) return setError(data.error); onChange({ ...item, tags: [...item.tags.filter(t => t.id !== data.tag.id), data.tag] }); setTag(""); }
  async function removeTag(tagId: string) { const response = await apiFetch(`/api/tags?savedAdId=${item.id}&tagId=${tagId}`, { method: "DELETE" }); if (response.ok) onChange({ ...item, tags: item.tags.filter(t => t.id !== tagId) }); }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Creative notes"
      description={item.ad.advertiser?.name ?? undefined}
      headerIcon={<StickyNote size={17} />}
    >
      <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[65vh]">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-500">Notes</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={5000} placeholder="Capture the hook, angle, offer, or why this creative matters…" className="mt-2 w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition" />
        </label>
        <Button onClick={saveNotes} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}Save notes
        </Button>

        <div className="border-t border-zinc-100 pt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500"><Folder size={13} />Swipe files</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {collections.map(collection => (
              <label key={collection.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-zinc-100 px-3 text-xs font-medium hover:bg-zinc-50 transition-colors">
                <input type="checkbox" className="accent-brand" checked={collectionIds.includes(collection.id)} onChange={() => setCollectionIds(current => current.includes(collection.id) ? current.filter(id => id !== collection.id) : [...current, collection.id])} />
                <span className="truncate">{collection.name}</span>
              </label>
            ))}
          </div>
          {collections.length ? (
            <Button variant="secondary" className="mt-3" onClick={saveCollections} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}Save folders
            </Button>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">Create a swipe file first, then assign this creative to it.</p>
          )}
        </div>

        <div className="border-t border-zinc-100 pt-5">
          <p className="text-xs font-semibold text-zinc-500">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map(current => (
              <span key={current.id} className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand">
                <Tag size={11} />{current.name}
                <button onClick={() => removeTag(current.id)}><X size={11} /></button>
              </span>
            ))}
          </div>
          <form onSubmit={addTag} className="mt-3 flex gap-2">
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder="UGC, Hook, Social Proof…" className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition" />
            <Button type="submit" variant="secondary" disabled={busy || !tag.trim()}>Add tag</Button>
          </form>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-signal">{error}</p>}
      </div>
    </ModalShell>
  );
}
