import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Create an AdsHunting account",
  description: "Create an AdsHunting account to start your private ad research workspace.",
  path: "/sign-up",
  noIndex: true,
});

import { authAppearance } from "@/lib/clerk-theme";
export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <SignUp appearance={authAppearance} routing="path" path="/sign-up" />
    </AuthShell>
  );
}
