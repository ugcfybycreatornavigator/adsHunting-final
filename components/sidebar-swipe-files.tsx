"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { FolderHeart, Plus, ChevronRight, Bookmark } from "lucide-react";
import { useSwipeFiles } from "@/hooks/use-swipe-files";
import { CreateSwipeFileModal } from "@/components/create-swipe-file-modal";
import { cn } from "@/lib/utils";

export function SidebarSwipeFiles({ onNavigate, isMobile }: { onNavigate?: () => void, isMobile?: boolean }) {
  const pathname = usePathname();
  const { data: files, isLoading, error } = useSwipeFiles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const isExactActive = pathname === "/swipe-files";
  const isDeepActive = pathname.startsWith("/swipe-files/") || pathname === "/saved";
  const isAnyActive = isExactActive || isDeepActive;
  
  const [isExpanded, setIsExpanded] = useState(isAnyActive);

  // Auto-expand if active, but only if it just became active
  useEffect(() => {
    if (isAnyActive) {
      setIsExpanded(true);
    }
  }, [isAnyActive]);
  
  // Sort by updatedAt if available, else fallback
  const sortedFiles = files ? [...files].sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  }) : [];

  // Display max 4 user files (Saved Ads is the 5th)
  const displayFiles = sortedFiles.slice(0, 4);
  const hasMore = sortedFiles.length > 4;

  const isSavedAdsActive = pathname === "/saved";

  return (
    <>
      <div className="flex flex-col">
        <div className="group relative flex h-[36px] items-center justify-between rounded-[10px] transition-all duration-150 outline-none">
          {/* Main Link Area */}
          <Link
            onClick={onNavigate}
            href="/swipe-files"
            className={cn(
              "flex flex-1 items-center gap-[11px] h-full rounded-[10px] pl-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white",
              isExactActive
                ? "bg-gradient-to-r from-[#68B32F] to-[#569b24] text-white font-semibold shadow-sm"
                : isDeepActive 
                  ? "text-[#18181B] font-medium" 
                  : "text-[#71717A] font-medium hover:bg-[#F7F7F8] hover:text-[#18181B]"
            )}
          >
            <FolderHeart size={17} strokeWidth={1.8} className={cn("shrink-0 transition-colors duration-150", isExactActive ? "text-white" : isAnyActive ? "text-[#52525B]" : "text-[#A1A1AA] group-hover:text-[#52525B]")} />
            <span className="truncate text-[13.5px]">Swipe Files</span>
          </Link>
          
          {/* Actions Column */}
          <div className="absolute right-1 flex items-center gap-[2px]">
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }}
              aria-label="Toggle swipe files"
              aria-expanded={isExpanded}
              className="flex size-[26px] items-center justify-center rounded-md text-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <ChevronRight size={16} className={cn("transition-transform duration-150", isExpanded && "rotate-90")} />
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                setIsCreateOpen(true);
              }}
              aria-label="Create swipe file"
              title="Create swipe file"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-md text-[#52525B] opacity-45 hover:opacity-100 hover:bg-[#F4F4F5] hover:text-[#18181B] transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Nested Files */}
        {isExpanded && !error && (
          <div className="mt-[2px] flex flex-col pl-[34px] pr-2 space-y-[2px]">
            {/* 1. Saved Ads */}
            <Link
              href="/saved"
              onClick={onNavigate}
              className={cn(
                "group/file relative flex h-[28px] items-center gap-[6px] rounded-[6px] px-[8px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white",
                isSavedAdsActive
                  ? "bg-gradient-to-r from-[#68B32F] to-[#569b24] text-white shadow-sm"
                  : "text-[#71717A] hover:bg-[#F7F7F8] hover:text-[#18181B]"
              )}
            >
              <Bookmark size={13} strokeWidth={2} className={cn("shrink-0", isSavedAdsActive ? "text-white" : "text-[#A1A1AA]")} />
              <span className={cn("truncate text-[13px]", isSavedAdsActive ? "font-medium" : "font-normal")}>
                Saved Ads
              </span>
            </Link>

            {/* 2. User Swipe Files */}
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex h-[28px] items-center pl-[2px]">
                  <div className="h-[12px] w-full max-w-[100px] animate-pulse rounded-sm bg-[#E5E7EB]" style={{ opacity: 1 - i * 0.3 }} />
                </div>
              ))
            ) : (
              <>
                {displayFiles.map((file) => {
                  const isFileActive = pathname === `/swipe-files/${file.id}`;
                  return (
                    <Link
                      key={file.id}
                      href={`/swipe-files/${file.id}`}
                      onClick={onNavigate}
                      title={file.name}
                      className={cn(
                        "group/file relative flex h-[28px] items-center rounded-[6px] px-[8px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-white",
                        isFileActive
                          ? "bg-gradient-to-r from-[#68B32F] to-[#569b24] text-white shadow-sm"
                          : "text-[#71717A] hover:bg-[#F7F7F8] hover:text-[#18181B]"
                      )}
                    >
                      <span className={cn("truncate text-[13px]", isFileActive ? "font-medium" : "font-normal")}>
                        {file.name}
                      </span>
                    </Link>
                  );
                })}
                
                {hasMore && (
                  <Link
                    href="/swipe-files"
                    onClick={onNavigate}
                    className="flex h-[28px] items-center rounded-[6px] px-[8px] text-[12.5px] font-normal text-[#A1A1AA] transition-colors hover:text-[#18181B] hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    View all
                  </Link>
                )}
              </>
            )}
          </div>
        )}
        {/* Error Fallback */}
        {isExpanded && error && (
          <div className="flex h-[28px] items-center pl-[38px] pr-2 text-[12.5px] text-signal/80">
            Failed to load
          </div>
        )}
      </div>

      {isCreateOpen && (
        <CreateSwipeFileModal 
          onClose={() => setIsCreateOpen(false)} 
          onCreated={() => {
            if (onNavigate && isMobile) onNavigate(); // Close mobile drawer if applicable
          }}
        />
      )}
    </>
  );
}
