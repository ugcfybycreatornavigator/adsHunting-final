"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function completeOnboarding() {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (error) {
    console.error("Failed to complete onboarding:", error);
    return { error: "Failed to update profile" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
