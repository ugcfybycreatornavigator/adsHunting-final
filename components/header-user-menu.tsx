"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import Link from "next/link";

export function HeaderUserMenu() {
  const { isSignedIn, isLoaded, user } = useUser();

  if (!isLoaded) {
    return <div className="size-8 rounded-full bg-line/40 animate-pulse" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="inline-flex min-h-9 items-center justify-center rounded-button border border-line px-3 text-xs font-semibold text-ink transition hover:bg-surface"
        >
          <LogIn className="mr-1.5 size-3.5 text-muted" />
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex min-h-9 items-center justify-center rounded-button bg-signal px-3.5 text-xs font-semibold text-white transition hover:bg-signal/90"
        >
          Create Account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:block text-right">
        <p className="text-xs font-bold text-ink truncate max-w-[140px]">
          {user.fullName || user.primaryEmailAddress?.emailAddress?.split('@')[0] || "User"}
        </p>
        <p className="text-[10px] text-muted font-medium">
          Personal account
        </p>
      </div>
      <UserButton
        userProfileMode="navigation"
        userProfileUrl="/settings"
        appearance={{
          elements: {
            avatarBox: "size-8 rounded-full border border-line shadow-sm",
          },
        }}
      />
    </div>
  );
}
