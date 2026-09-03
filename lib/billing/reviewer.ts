import "server-only";
import { currentUser } from "@clerk/nextjs/server";

// TEMPORARY: Payment-provider reviewer access.
// Remove/disable after Razorpay/Cashfree production verification.
export async function isPaymentReviewer(workspaceId: string): Promise<boolean> {
  if (process.env.ENABLE_PAYMENT_REVIEWER_LOGIN !== "true") {
    return false;
  }

  const user = await currentUser();
  if (!user) {
    return false;
  }

  // Double check that the workspaceId belongs to the authenticated user.
  if (user.id !== workspaceId) {
    return false;
  }

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  const reviewerEmail = process.env.PAYMENT_REVIEWER_EMAIL;

  if (reviewerEmail && primaryEmail === reviewerEmail) {
    console.log("[Auth] payment_reviewer_authenticated via bypass for user:", primaryEmail);
    return true;
  }

  return false;
}
