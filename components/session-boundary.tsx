"use client";
import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { mutate } from "swr";

export function SessionBoundary() {
  const { signOut } = useClerk();

  useEffect(() => {
    const handleSessionReplaced = async () => {
      // 1. stop protected requests
      sessionStorage.setItem("session_invalidated", "true");
      
      // 2. clear SWR cache safely
      await mutate(() => true, undefined, { revalidate: false });
      
      // 3. sign out Clerk & redirect
      await signOut({ redirectUrl: "/sign-in?reason=session-replaced" });
    };

    window.addEventListener("session-replaced", handleSessionReplaced);
    return () => {
      window.removeEventListener("session-replaced", handleSessionReplaced);
    };
  }, [signOut]);

  return null;
}
