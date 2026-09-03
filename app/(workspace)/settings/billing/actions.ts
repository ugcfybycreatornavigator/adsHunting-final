"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function cancelSubscription() {
  const { userId } = await requireUser();
  if (!userId) {
    return { error: "Authentication required" };
  }

  const admin = createAdminClient();
  
  const { data: sub, error: fetchError } = await admin
    .from("billing_subscriptions")
    .select("status, id, current_period_end")
    .eq("workspace_id", userId)
    .maybeSingle();

  if (fetchError || !sub) {
    return { error: "No active subscription found to cancel." };
  }

  if (sub.status === "cancelled") {
    return { error: "Subscription is already cancelled." };
  }

  // Update subscription to cancelled in the DB
  const { error: updateError } = await admin
    .from("billing_subscriptions")
    .update({ 
      status: "cancelled",
      // Keep current_period_end intact so they retain access until the end of the period
    })
    .eq("id", sub.id);

  if (updateError) {
    console.error("Cancellation error:", updateError);
    return { error: "Failed to cancel subscription." };
  }

  revalidatePath("/settings/billing");
  return { success: true };
}
