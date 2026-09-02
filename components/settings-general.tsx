"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { Button, Card } from "@/components/ui";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function SettingsGeneral() {
  const { isLoaded, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  if (!isLoaded || !user) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-[12px] bg-[#F4F4F5]" />
        <div className="h-40 animate-pulse rounded-[12px] bg-[#F4F4F5]" />
      </div>
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B]">Profile</h3>
        <p className="mt-1 text-[13.5px] text-[#71717A]">Your personal account information.</p>
        
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <img src={user.imageUrl} alt="Avatar" className="size-16 rounded-full border border-black/10 object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[#18181B] truncate">{user.fullName || "User"}</p>
            <p className="text-[13px] text-[#71717A] truncate">{user.primaryEmailAddress?.emailAddress}</p>
            {user.primaryPhoneNumber?.phoneNumber && (
               <p className="text-[13px] text-[#71717A] truncate">{user.primaryPhoneNumber.phoneNumber}</p>
            )}
          </div>
          <Button variant="secondary" className="sm:w-auto w-full h-[36px] text-[13px] font-medium" onClick={() => openUserProfile()}>
            Edit Profile
          </Button>
        </div>
      </Card>

      <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B]">Session</h3>
        <p className="mt-1 text-[13.5px] text-[#71717A]">Manage your active authentication session.</p>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#18181B] truncate">Signed in as</p>
            <p className="text-[13px] text-[#71717A] truncate">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto justify-center h-[36px] text-[13px] font-medium" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={16} className="mr-2" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
