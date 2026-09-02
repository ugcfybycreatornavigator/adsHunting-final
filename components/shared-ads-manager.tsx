"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Link2, Copy, Trash2, Calendar, FileText, Ban, Eye, Globe, FolderHeart } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import type { SharedAdLink } from "@/lib/types";

export function SharedAdsManager() {
  const [links, setLinks] = useState<SharedAdLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  useEffect(() => {
    fetchSharedLinks();
  }, []);

  async function fetchSharedLinks() {
    setLoading(true);
    try {
      const response = await apiFetch("/api/shared-ads");
      if (!response.ok) throw new Error("Failed to load shared ads.");
      const data = await response.json();
      setLinks(data.links);
    } catch (err: unknown) {
      setError({ message: err instanceof Error ? err.message : "An error occurred" });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  async function revokeLink(id: string) {
    const originalLinks = [...links];
    setLinks(links.map(l => l.id === id ? { ...l, status: "disabled", revokedAt: new Date().toISOString() } : l));
    try {
      const res = await apiFetch(`/api/shared-ads/${id}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to revoke");
    } catch (e) {
      console.error(e);
      setLinks(originalLinks);
    }
  }
  
  async function enableLink(id: string) {
    const originalLinks = [...links];
    setLinks(links.map(l => l.id === id ? { ...l, status: "active", revokedAt: undefined } : l));
    try {
      const res = await apiFetch(`/api/shared-ads/${id}/enable`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to enable");
    } catch (e) {
      console.error(e);
      setLinks(originalLinks);
    }
  }

  async function deleteLink(id: string) {
    if (!confirm("Are you sure you want to permanently delete this shared link? The underlying ads will not be deleted.")) return;
    const originalLinks = [...links];
    setLinks(links.filter(l => l.id !== id));
    try {
      const res = await apiFetch(`/api/shared-ads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (e) {
      console.error(e);
      setLinks(originalLinks);
    }
  }

  async function toggleVisibility(id: string, currentVisibility: "public" | "private") {
    const newVisibility = currentVisibility === "public" ? "private" : "public";
    const originalLinks = [...links];
    setLinks(links.map(l => l.id === id ? { ...l, visibility: newVisibility } : l));
    try {
      const res = await apiFetch(`/api/shared-ads/${id}/visibility`, { 
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVisibility })
      });
      if (!res.ok) throw new Error("Failed to update visibility");
    } catch (e) {
      console.error(e);
      setLinks(originalLinks);
      alert("Failed to update visibility");
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-zinc-500 animate-pulse">Loading shared ads...</div>;
  }

  if (error) {
    return (
      <EmptyState
        icon={<Link2 />}
        title="Couldn't load shared ads."
        body={error.message}
        action={<Button variant="secondary" onClick={fetchSharedLinks}>Try again</Button>}
      />
    );
  }

  if (links.length === 0) {
    return (
      <EmptyState
        icon={<Globe className="text-brand" />}
        title="No shared creatives yet"
        body="Share an ad from Discover or Saved Ads to create your first link."
        action={<a href="/discover" className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">Discover Ads</a>}
      />
    );
  }

  const activeLinks = links.filter(l => l.status === "active").length;
  const expiredLinks = links.filter(l => l.status === "expired" || l.status === "disabled").length;
  const totalViews = links.reduce((acc, curr) => acc + (curr.views || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="text-sm font-medium text-muted">Active links</div>
          <div className="mt-2 text-3xl font-bold text-ink">{activeLinks}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="text-sm font-medium text-muted">Total views</div>
          <div className="mt-2 text-3xl font-bold text-ink">{totalViews}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="text-sm font-medium text-muted">Expired / Disabled</div>
          <div className="mt-2 text-3xl font-bold text-ink">{expiredLinks}</div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Shared Content</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4">Views</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-zinc-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-ink">{link.name}</div>
                    <div className="text-xs text-muted flex items-center gap-1 mt-1">
                      {link.contentType === "single" ? <FileText size={12}/> : link.contentType === "multiple" ? <FileText size={12}/> : <FolderHeart size={12}/>}
                      {link.contentType === "swipe_file" ? "Swipe File" : link.contentType === "single" ? "Single Ad" : "Multiple Ads"}
                      {link.itemCount ? ` • ${link.itemCount} items` : ""}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        link.status === "active" ? "bg-green-50 text-green-700" :
                        link.status === "expired" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      }`}>
                        {link.status?.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        link.visibility === "public" ? "bg-brand text-brand" : "bg-zinc-100 text-zinc-700"
                      }`}>
                        {link.visibility === "public" ? "PUBLIC" : "PRIVATE"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {link.expiresAt ? (
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      "No expiry"
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 font-medium text-ink">
                      <Eye size={14} className="text-muted"/>
                      {link.views || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleVisibility(link.id, link.visibility)} className="p-2 text-muted hover:text-ink hover:bg-line rounded-md transition" title={link.visibility === "public" ? "Make Private" : "Make Public"}>
                        <Globe size={16} className={link.visibility === "public" ? "text-brand" : "text-muted"} />
                      </button>
                      <button onClick={() => copyLink(link.tokenHash)} className="p-2 text-muted hover:text-ink hover:bg-line rounded-md transition" title="Copy Link">
                        <Copy size={16} />
                      </button>
                      
                      {link.status === "disabled" ? (
                         <button onClick={() => enableLink(link.id)} className="p-2 text-muted hover:text-green-600 hover:bg-green-50 rounded-md transition" title="Enable Access">
                          <Link2 size={16} />
                         </button>
                      ) : (
                        <button onClick={() => revokeLink(link.id)} className="p-2 text-muted hover:text-amber-600 hover:bg-amber-50 rounded-md transition" title="Disable Access">
                          <Ban size={16} />
                        </button>
                      )}

                      <button onClick={() => deleteLink(link.id)} className="p-2 text-muted hover:text-signal hover:bg-red-50 rounded-md transition" title="Delete Record">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Cards Layout */}
        <div className="md:hidden flex flex-col divide-y divide-line">
          {links.map((link) => (
            <div key={link.id} className="flex flex-col p-4 gap-3">
              <div>
                <div className="font-semibold text-ink">{link.name}</div>
                <div className="text-xs text-muted mt-1 capitalize">
                  {link.visibility} &middot; {link.status}
                </div>
              </div>
              
              <div className="text-xs text-muted flex items-center gap-3">
                <span className="font-medium text-ink flex items-center gap-1.5"><Eye size={13} className="text-muted"/> {link.views || 0} views</span>
              </div>
              
              <div className="flex items-center gap-2 pt-3 border-t border-line mt-1">
                <Button variant="secondary" onClick={() => copyLink(link.tokenHash)} className="flex-1 min-h-[36px] px-3 gap-1.5 text-xs">
                  <Copy size={14} /> Copy
                </Button>
                <Button variant="secondary" onClick={() => window.open(`/share/${link.tokenHash}`, '_blank')} className="flex-1 min-h-[36px] px-3 gap-1.5 text-xs">
                  <Globe size={14} /> Open
                </Button>
                {link.status === "disabled" ? (
                  <Button variant="ghost" onClick={() => enableLink(link.id)} className="px-3 min-h-[36px] text-muted hover:text-green-600">
                    <Link2 size={16} />
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => revokeLink(link.id)} className="px-3 min-h-[36px] text-muted hover:text-amber-600">
                    <Ban size={16} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
