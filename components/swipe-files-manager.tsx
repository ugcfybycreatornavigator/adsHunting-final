"use client";
import { apiFetch } from "@/lib/api-client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Folder, FolderPlus, Loader2, Trash2, Bookmark } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import type { SwipeFile } from "@/lib/types";
import { ModalShell } from "@/components/modal-shell";
import { useSwipeFiles } from "@/hooks/use-swipe-files";

export function SwipeFilesManager({ initialData }: { initialData?: SwipeFile[] }) {
  const { data: files, isLoading: loading, mutate } = useSwipeFiles(initialData);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<SwipeFile | "new" | null>(null);



  async function remove(event: React.MouseEvent, file: SwipeFile) {
    event.preventDefault();
    event.stopPropagation();
    if (file.isSystem) {
      alert("You cannot delete the default Swipe File.");
      return;
    }
    if (!confirm(`Delete “${file.name}”?`)) return;
    try {
      await mutate(
        (current) => current?.filter((f) => f.id !== file.id) || [],
        { revalidate: false }
      );
      const response = await apiFetch(`/api/swipe-files/${file.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
         // Revert on error
         mutate();
         throw new Error(data.error);
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete folder.");
    }
  }

  if (loading && (!files || files.length === 0)) return (
    <div className="grid gap-[14px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col h-[155px] overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm">
          <Skeleton className="h-[72px] w-full rounded-none" />
          <div className="p-[14px] flex flex-col h-full">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-[4px] h-3 w-1/2" />
            <div className="mt-auto pt-[12px] flex justify-between">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return <>
    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-signal">{error}</p>}
    {files.length > 0 && (
      <div className="grid gap-[14px] grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {/* Create Card */}
        <button 
          onClick={() => setModal("new")} 
          className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-dashed border-zinc-300 bg-white/80 text-left transition-all duration-150 ease-out hover:-translate-y-[1px] hover:border-brand/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <div className="h-[72px] shrink-0 w-full bg-[#F7F7F8] relative overflow-hidden flex items-center justify-center transition-colors group-hover:bg-[#FFF7F8]">
            <div className="relative flex items-center justify-center text-zinc-300 group-hover:text-brand/40 transition-colors">
              <Folder size={32} />
              <div className="absolute -top-1 -right-3 w-[26px] h-[34px] bg-white border border-zinc-200 group-hover:border-brand/20 rounded-[4px] shadow-sm rotate-[12deg] flex items-center justify-center text-zinc-400 group-hover:text-brand transition-colors">
                <FolderPlus size={14} />
              </div>
            </div>
          </div>
          <div className="p-[14px] flex flex-col flex-1">
            <h3 className="text-[15px] font-[650] text-ink">Create new Swipe File</h3>
            <p className="mt-[3px] text-[12px] text-muted line-clamp-1">Organize a creative angle</p>
            <div className="mt-auto pt-[12px] flex items-center justify-end">
               <span className="flex items-center gap-1 text-[12px] font-[600] text-ink transition-colors group-hover:text-brand">
                Create <FolderPlus size={14} className="ml-0.5" />
              </span>
            </div>
          </div>
        </button>

        {/* Swipe Files */}
        {files.map((file) => (
          <Link 
            href={`/swipe-files/${file.id}`} 
            key={file.id} 
            className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] shadow-sm transition-all duration-150 ease-out hover:-translate-y-[1px] hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <div className="shrink-0">
              <FolderPreviewGraphic file={file} />
            </div>
            
            <div className="p-[14px] flex flex-col flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-[15px] font-[650] text-ink" title={file.name}>{file.name}</h3>
                {file.isSystem ? (
                  <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-[600] text-brand uppercase tracking-wide">
                    Default
                  </span>
                ) : (
                  <button 
                    onClick={(e) => remove(e, file)} 
                    aria-label="Delete folder" 
                    className="shrink-0 -mr-1 -mt-1 grid size-7 place-items-center rounded-md text-muted opacity-100 transition-colors hover:bg-red-50 hover:text-signal sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              
              <p className="mt-[3px] line-clamp-1 text-[12px] text-muted" title={file.description || ""}>
                {file.description || (file.isSystem ? "Your main creative library" : "Curated creative references")}
              </p>
              
              <div className="mt-auto pt-[12px] flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted">
                  {file.adCount || 0} creatives
                </span>
                <span className="flex items-center gap-1 text-[12px] font-[600] text-ink transition-colors group-hover:text-brand">
                  Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-[2px]" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    )}
    {files.length === 0 && !loading && (
      <div className="mt-8 flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#E5E7EB] bg-white p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#F4F4F5] text-[#A1A1AA]">
          <Folder size={24} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#18181B]">No Swipe Files yet</h3>
        <p className="mt-2 max-w-sm text-sm text-[#71717A]">
          Organize saved ads into collections for campaigns, competitors, hooks, formats, or inspiration.
        </p>
        <Button onClick={() => setModal("new")} variant="secondary" className="mt-6">
          <FolderPlus size={14} className="mr-2" /> Create Swipe File
        </Button>
      </div>
    )}
    {modal && <SwipeFileModal file={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); mutate(); }} />}
  </>;
}

import { ImageIcon } from "lucide-react";

function FolderPreviewGraphic({ file }: { file: SwipeFile }) {
  const hasMedia = file.previewMedia && file.previewMedia.length > 0;
  
  if (hasMedia) {
    return (
      <div className="h-[72px] w-full bg-[#F7F7F8] relative overflow-hidden flex items-end justify-center pb-2 border-b border-line group-hover:border-zinc-300 transition-colors">
        {file.previewMedia!.map((src, idx) => (
          <PreviewTile key={idx} src={src} index={idx} total={file.previewMedia!.length} />
        ))}
      </div>
    );
  }

  return (
    <div className="h-[72px] w-full bg-[#F7F7F8] relative overflow-hidden flex items-center justify-center border-b border-line group-hover:border-zinc-300 transition-colors">
      {file.isSystem ? (
         <div className="relative flex items-center justify-center text-brand/20 group-hover:text-brand/30 transition-colors">
           <Bookmark size={32} />
           <div className="absolute top-1 right-0 w-[22px] h-[30px] bg-white border border-zinc-200 rounded-[3px] shadow-sm rotate-[15deg] group-hover:border-brand/20 transition-colors opacity-80"></div>
           <div className="absolute top-1 left-0 w-[22px] h-[30px] bg-white border border-zinc-200 rounded-[3px] shadow-sm -rotate-[15deg] group-hover:border-brand/20 transition-colors opacity-80"></div>
           <Bookmark size={32} className="absolute inset-0 text-brand/40 group-hover:text-brand/60 transition-colors" />
         </div>
      ) : (
         <div className="relative flex items-center justify-center text-zinc-300 group-hover:text-zinc-400 transition-colors mt-2">
           <Folder size={36} />
           <div className="absolute -top-3 -right-2 w-[22px] h-[30px] bg-white border border-zinc-200 rounded-[3px] shadow-sm rotate-[15deg] group-hover:border-zinc-300 transition-colors"></div>
           <div className="absolute -top-3 -left-2 w-[22px] h-[30px] bg-white border border-zinc-200 rounded-[3px] shadow-sm -rotate-[15deg] group-hover:border-zinc-300 transition-colors"></div>
         </div>
      )}
    </div>
  );
}

function PreviewTile({ src, index, total }: { src: string; index: number; total: number }) {
  const [failed, setFailed] = useState(false);
  
  let transform = "translateY(0) rotate(0)";
  let zIndex = 10;
  
  if (total === 1) {
    transform = "translateY(4px) rotate(0)";
  } else if (total === 2) {
    if (index === 0) { transform = "translateX(-12px) translateY(6px) rotate(-6deg)"; zIndex = 5; }
    if (index === 1) { transform = "translateX(12px) translateY(6px) rotate(6deg)"; zIndex = 10; }
  } else {
    if (index === 0) { transform = "translateX(-24px) translateY(8px) rotate(-8deg)"; zIndex = 5; }
    if (index === 1) { transform = "translateY(4px) rotate(0)"; zIndex = 10; }
    if (index === 2) { transform = "translateX(24px) translateY(8px) rotate(8deg)"; zIndex = 5; }
  }

  return (
    <div 
      className="absolute bottom-0 w-[42px] h-[54px] rounded-[4px] bg-white border border-line shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-transform duration-300 group-hover:-translate-y-1"
      style={{ transform, zIndex }}
    >
      {!failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} className="w-full h-full object-cover text-transparent" />
      ) : (
        <div className="w-full h-full bg-zinc-50 flex items-center justify-center text-brand/40">
           <ImageIcon size={14} />
        </div>
      )}
    </div>
  );
}

function SwipeFileModal({ file, onClose, onSaved }: { file: SwipeFile | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(file?.name || "");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); 
    setBusy(true);
    const response = await apiFetch("/api/swipe-files", { 
      method: "POST", // only create is supported right now, no update endpoint implemented yet
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ name }) 
    });
    const data = await response.json(); 
    setBusy(false);
    if (!response.ok) return setError(data.error);
    onSaved();
  }

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="Create Swipe File"
      description="Organize your saved creatives into folders."
      headerIcon={<FolderPlus size={18} />}
    >
      <form onSubmit={submit} className="p-5 sm:p-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Swipe File name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            placeholder="Winning Hooks"
          />
        </label>
        {error && <p className="rounded-xl bg-red-50 p-3 text-xs text-signal">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
            {busy && <Loader2 size={15} className="animate-spin" />}Create
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
