import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Sign in to AdsHunting",
  description: "Sign in to your private AdsHunting workspace.",
  path: "/sign-in",
  noIndex: true,
});

import { authAppearance } from "@/lib/clerk-theme";
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const params = await searchParams;
  const isSessionReplaced = params.reason === "session-replaced";

  return (
    <AuthShell mode="sign-in">
      {isSessionReplaced && (
        <div className="mb-6 rounded-[10px] bg-red-50 p-4 border border-red-100">
          <p className="text-[13px] font-semibold text-red-800">Signed out for security</p>
          <p className="mt-1 text-[13px] text-red-700 leading-relaxed">
            Your account was signed in on another device, so this session was ended.
          </p>
        </div>
      )}

      <SignIn appearance={authAppearance} routing="path" path="/sign-in" />
    </AuthShell>
  );
}
