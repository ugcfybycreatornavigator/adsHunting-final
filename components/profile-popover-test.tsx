"use client";
import { useState, useRef, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Settings, LogOut, MoreHorizontal } from "lucide-react";

export function ProfilePopover() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative w-full" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center gap-3 rounded-[12px] pt-[12px] pb-[10px] px-[10px] transition duration-150 hover:bg-[#151820] border-t border-white/[0.07] bg-transparent text-left"
      >
        <img
          src={user.imageUrl}
          alt=""
          className="size-[34px] shrink-0 rounded-full border border-white/10 object-cover"
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <p className="truncate text-[13px] font-semibold text-[#F7F7F8]">
            {user.fullName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || "User"}
          </p>
          <p className="truncate text-[11px] text-[#777C88]">Personal account</p>
        </div>
        <MoreHorizontal size={16} className="text-[#6F7380] group-hover:text-[#A1A1AA] transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-[260px] rounded-[14px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3 px-2 pb-3 pt-2">
            <img src={user.imageUrl} alt="" className="size-9 rounded-full border border-line object-cover" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[13px] font-semibold text-[#111216]">{user.fullName}</span>
              <span className="truncate text-[12px] text-[#71717A]">{user.primaryEmailAddress?.emailAddress}</span>
            </div>
          </div>
          <div className="h-px w-full bg-[#ECEDEF] my-1" />
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => {
                setIsOpen(false);
                openUserProfile();
              }}
              className="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium text-[#3F3F46] transition hover:bg-[#F5F5F6] hover:text-[#111216] group"
            >
              <Settings size={16} className="text-[#71717A] group-hover:text-[#111216] transition" />
              Manage account
            </button>
            <button
              onClick={() => signOut()}
              className="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium text-[#3F3F46] transition hover:bg-[#FFF1F2] hover:text-[#DC2626] group"
            >
              <LogOut size={16} className="text-[#71717A] group-hover:text-[#DC2626] transition" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
