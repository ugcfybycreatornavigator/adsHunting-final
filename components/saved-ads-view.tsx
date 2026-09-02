"use client";
import { apiFetch } from "@/lib/api-client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkX, Check, Folder, Loader2, Search, Tag, X } from "lucide-react";
import { AdCard } from "@/components/ad-card";
import { AdDetailDrawer } from "@/components/ad-detail";
import { EmptyState, Button, Skeleton } from "@/components/ui";
import { ShareModal } from "@/components/share-modal";
import type { SwipeFile, NormalizedAd } from "@/lib/types";

type Saved = { id: string; notes: string | null; createdAt: string; ad: NormalizedAd; tags: { id: string; name: string }[]; collectionIds: string[] };

export function SavedAdsView({ collectionId }: { collectionId?: string }) {
  const [items, setItems] = useState<Saved[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [query, setQuery] = useState(""); const [details, setDetails] = useState<NormalizedAd | null>(null); const [editing, setEditing] = useState<Saved | null>(null); const [toast, setToast] = useState<string | null>(null); const [shareAdId, setShareAdId] = useState<string | null>(null); const [shareCollection, setShareCollection] = useState<boolean>(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await apiFetch(`/api/swipe-files/ads${collectionId ? `?swipeFileId=${collectionId}` : ""}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); setItems(Array.isArray(data.items) ? data.items : []); } catch (error) { setItems([]); setError(error instanceof Error ? error.message : "Unable to load saved ads."); } finally { setLoading(false); } }, [collectionId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2400); return () => window.clearTimeout(timer); }, [toast]);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return items; return items.filter(item => [item.ad?.advertiser?.name,item.ad?.copy?.headline,item.ad?.copy?.primaryText,item.notes,...(item.tags || []).map(t=>t.name)].some(value => typeof value === "string" && value.toLowerCase().includes(q))); }, [items, query]);
  async function remove(id: string) { if (!confirm("Remove this creative from Saved Ads?")) return; const response = await apiFetch(`/api/swipe-files/ads?id=${id}`, { method: "DELETE" }); if (response.ok) setItems(current => current.filter(item => item.id !== id)); }
  async function share(ad: NormalizedAd) { setShareAdId(ad.id); }
  if (loading) return <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))' }}>{Array.from({length:6}).map((_,i)=><div key={i} className="flex flex-col w-full overflow-hidden rounded-[12px] border border-line bg-white shadow-sm"><div className="flex h-[52px] items-center gap-2.5 px-3"><Skeleton className="size-7 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div></div><Skeleton className="w-full aspect-[4/5] rounded-none" /><div className="flex w-full min-h-[44px] border-b border-line items-center px-3"><Skeleton className="h-4 w-12" /></div><div className="flex flex-col border-t border-line px-3 py-3 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div><div className="flex w-full min-h-[44px] border-t border-line items-center px-2 gap-2"><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="h-7 flex-1 rounded-md" /><Skeleton className="size-8 rounded-md shrink-0" /></div></div>)}</div>;
  if (error) return <EmptyState icon={<BookmarkX />} title="Saved ads unavailable" body={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />;
  return <div className="flex h-full flex-col p-4 md:p-8 max-w-[1600px] mx-auto w-full">
    {!collectionId && (
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Saved Ads</h1>
        <p className="mt-1 text-sm text-muted">Review and organize your saved creative references.</p>
      </div>
    )}
    
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search saved creatives, notes, tags…" className="h-11 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" />
      </div>
      <div className="flex items-center gap-4">
        <p className="text-sm font-medium text-muted">{filtered.length} creative{filtered.length === 1 ? "" : "s"}</p>
        {collectionId && items.length > 0 && <Button variant="secondary" onClick={() => setShareCollection(true)}>Share Swipe File</Button>}
      </div>
    </div>
    
    {!filtered.length ? (
      <EmptyState icon={<BookmarkX />} title={items.length ? "No saved ads match" : "No saved creatives yet"} body={items.length ? "Try another search term." : "Save ads from Discover and they'll appear here."} action={!items.length ? <a href="/discover" className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong">Discover Ads</a> : undefined} />
    ) : (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))' }}>
        {filtered.map(item => (
          <div key={item.id} className="flex flex-col">
            <AdCard 
              ad={item.ad} 
              saved 
              swipeFileCount={item.collectionIds.length} 
              onOpen={()=>setDetails(item.ad)} 
              onSave={()=>undefined} 
              initialCollectionIds={item.collectionIds} 
              onSwipeFileAdded={() => undefined} 
              onShare={()=>share(item.ad)}
              hasNote={!!item.notes}
              tags={item.tags}
              onNoteClick={() => setEditing(item)}
              onTagsClick={() => setEditing(item)}
              onRemoveClick={() => remove(item.id)}
            />
          </div>
        ))}
      </div>
    )}
    
    {details && <AdDetailDrawer ad={details} saved onClose={()=>setDetails(null)} onSave={()=>{ const item=items.find(i=>i.ad.id===details.id); if(item)setEditing(item); }} />}
    {editing && <NotesModal item={editing} onClose={()=>setEditing(null)} onChange={updated=>setItems(current=>current.map(item=>item.id===updated.id?updated:item))} />}
    {shareAdId && <ShareModal isOpen={true} onClose={() => setShareAdId(null)} adIds={[shareAdId]} />}
    {shareCollection && collectionId && <ShareModal isOpen={true} onClose={() => setShareCollection(false)} adIds={items.map(i => i.ad.id)} swipeFileId={collectionId} defaultName="Shared Swipe File" />}
    {toast && <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold shadow-card" role="status">{toast}</div>}
  </div>;
}
function NotesModal({ item, onClose, onChange }: { item: Saved; onClose: ()=>void; onChange:(item:Saved)=>void }) {
  const [notes,setNotes]=useState(item.notes||""); const [tag,setTag]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [collections,setCollections]=useState<SwipeFile[]>([]); const [collectionIds,setCollectionIds]=useState(item.collectionIds);
  useEffect(()=>{apiFetch("/api/swipe-files").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setCollections(data);}).catch(error=>setError(error instanceof Error?error.message:"Unable to load swipe files."));},[]);
  async function saveNotes(){setBusy(true);const response=await apiFetch("/api/swipe-files/ads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,notes})});setBusy(false);if(!response.ok){const data=await response.json();return setError(data.error);}onChange({...item,notes});}
  async function saveCollections(){setBusy(true);setError("");const response=await apiFetch("/api/swipe-files/ads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,collectionIds})});const data=await response.json();setBusy(false);if(!response.ok)return setError(data.error);onChange({...item,collectionIds});}
  async function addTag(event:FormEvent){event.preventDefault();if(!tag.trim())return;setBusy(true);const response=await apiFetch("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({savedAdId:item.id,name:tag})});const data=await response.json();setBusy(false);if(!response.ok)return setError(data.error);onChange({...item,tags:[...item.tags.filter(t=>t.id!==data.tag.id),data.tag]});setTag("");}
  async function removeTag(tagId:string){const response=await apiFetch(`/api/tags?savedAdId=${item.id}&tagId=${tagId}`,{method:"DELETE"});if(response.ok)onChange({...item,tags:item.tags.filter(t=>t.id!==tagId)});}
  return <div className="fixed inset-0 z-[80] grid place-items-end bg-black/25 sm:place-items-center sm:p-4" onMouseDown={onClose}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Creative notes</h2><p className="mt-1 text-xs text-muted">{item.ad.advertiser?.name}</p></div><button onClick={onClose} className="grid size-10 place-items-center"><X size={18}/></button></div><label className="mt-5 block text-xs font-semibold text-muted">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} maxLength={5000} placeholder="Capture the hook, angle, offer, or why this creative matters…" className="mt-2 w-full resize-none rounded-lg border border-line p-3 text-sm leading-6 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft" /></label><Button onClick={saveNotes} className="mt-2" disabled={busy}>{busy?<Loader2 className="animate-spin" size={15}/>:<Check size={15}/>}Save notes</Button><div className="mt-6 border-t border-line pt-5"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Folder size={13}/>Swipe files</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{collections.map(collection=><label key={collection.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-xs font-medium"><input type="checkbox" className="accent-brand" checked={collectionIds.includes(collection.id)} onChange={()=>setCollectionIds(current=>current.includes(collection.id)?current.filter(id=>id!==collection.id):[...current,collection.id])}/><span className="truncate">{collection.name}</span></label>)}</div>{collections.length?<Button variant="secondary" className="mt-3" onClick={saveCollections} disabled={busy}>{busy?<Loader2 className="animate-spin" size={15}/>:<Check size={15}/>}Save folders</Button>:<p className="mt-2 text-xs text-muted">Create a swipe file first, then assign this creative to it.</p>}</div><div className="mt-6 border-t border-line pt-5"><p className="text-xs font-semibold text-muted">Tags</p><div className="mt-2 flex flex-wrap gap-2">{item.tags.map(current=><span key={current.id} className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand"><Tag size={11}/>{current.name}<button onClick={()=>removeTag(current.id)}><X size={11}/></button></span>)}</div><form onSubmit={addTag} className="mt-3 flex gap-2"><input value={tag} onChange={e=>setTag(e.target.value)} placeholder="UGC, Hook, Social Proof…" className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft"/><Button type="submit" variant="secondary" disabled={busy||!tag.trim()}>Add tag</Button></form></div>{error&&<p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-signal">{error}</p>}</div></div>;
}
