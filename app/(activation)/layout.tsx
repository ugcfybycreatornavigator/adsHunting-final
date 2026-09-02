import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { isPreviewMode } from "@/lib/preview";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Activate AdsHunting",
  description: "Set up your AdsHunting account.",
  noIndex: true,
});

export default async function ActivationLayout({ children }: { children: React.ReactNode }) {
  if (!isPreviewMode) await auth.protect();
  const authState = await auth();
  if (!authState.userId && !isPreviewMode) redirect("/sign-in");
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="absolute top-6 right-8">
        <UserButton />
      </div>
      {children}
    </div>
  );
}
