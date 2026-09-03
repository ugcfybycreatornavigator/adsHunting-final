"use client";

import { useState } from "react";
import { Copy, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  adIds: string[];
  swipeFileId?: string;
  defaultName?: string;
}

export function ShareModal({ isOpen, onClose, adIds, swipeFileId, defaultName }: ShareModalProps) {
  const [name, setName] = useState(defaultName || "My Shared Ads");
  const [message, setMessage] = useState("");
  const [expiryPreset, setExpiryPreset] = useState("30"); // 30 days
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [allowSave, setAllowSave] = useState(false);
  const [allowDownload, setAllowDownload] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleCreateShare() {
    setLoading(true);
    try {
      let expiresAt = null;
      if (expiryPreset !== "never") {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiryPreset, 10));
        expiresAt = d.toISOString();
      }

      const res = await fetch("/api/shared-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          contentType: swipeFileId ? "swipe_file" : adIds.length > 1 ? "multiple" : "single",
          swipeFileId,
          adIds,
          expiresAt,
          visibility,
          allowSave,
          allowDownload
        })
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to create share");
      
      setSharedLink(`${window.location.origin}/share/${data.token}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Couldn't create this share link. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!sharedLink) return;
    await navigator.clipboard.writeText(sharedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Share ads securely</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        {sharedLink ? (
          <div className="p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-50 mb-4">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <h3 className="text-lg font-medium text-ink mb-1">Link created!</h3>
            <p className="text-sm text-muted mb-6">Anyone with this link can view the shared ads after logging in.</p>
            
            <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-lg border border-line mb-6">
              <input type="text" readOnly value={sharedLink} className="flex-1 bg-transparent text-sm text-ink outline-none px-2" />
              <Button variant={copied ? "primary" : "secondary"} onClick={copyToClipboard} className="shrink-0 gap-1.5 px-3 py-1.5 min-h-[auto] text-xs">
                {copied ? <CheckCircle2 size={14}/> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Share name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Message (Optional)</label>
              <textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand outline-none resize-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Link expiry</label>
              <select 
                value={expiryPreset} 
                onChange={(e) => setExpiryPreset(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none"
              >
                <option value="1">24 hours</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="never">No expiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Who can view</label>
              <div className="flex rounded-lg border border-line bg-zinc-50 p-1">
                <button
                  onClick={() => setVisibility("public")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${visibility === "public" ? "bg-white text-ink shadow-sm ring-1 ring-black/5" : "text-muted hover:text-ink"}`}
                >
                  Public link
                </button>
                <button
                  onClick={() => setVisibility("private")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${visibility === "private" ? "bg-white text-ink shadow-sm ring-1 ring-black/5" : "text-muted hover:text-ink"}`}
                >
                  Private (Requires login)
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-line space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allowSave} onChange={(e) => setAllowSave(e.target.checked)} className="rounded text-signal focus:ring-brand" />
                <span className="text-sm text-ink font-medium">Allow saving to swipe file</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} className="rounded text-signal focus:ring-brand" />
                <span className="text-sm text-ink font-medium">Allow media download</span>
              </label>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-signal font-medium border border-red-100">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button className="flex-1" onClick={handleCreateShare} disabled={loading || !name.trim()}>
                  {loading ? "Creating..." : "Create secure link"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
