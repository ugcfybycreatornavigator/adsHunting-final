"use client";
import { useState, useEffect } from "react";
import { Share2 } from "lucide-react";

export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  
  useEffect(() => {
    setUrl(`${window.location.origin}/share/${token}`);
  }, [token]);

  if (!url) return null;

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // fallback
        }
      }}
      className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition bg-white border border-line rounded-md px-3 py-1.5 shadow-sm"
    >
      <Share2 size={14} />
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
