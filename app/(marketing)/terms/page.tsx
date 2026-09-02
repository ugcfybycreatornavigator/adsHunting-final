import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal/LegalPage";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Terms of Service",
  description:
    "Review the AdsHunting terms of service for product access, account responsibilities, subscriptions, and acceptable use.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 22, 2026">
      <section>
        <h2>Use of AdsHunting</h2>
        <p>
          AdsHunting provides software for discovering, reviewing, saving, organizing, and sharing advertising creative research. You are responsible for using the service lawfully and for maintaining the security of your account.
        </p>
      </section>
      <section>
        <h2>Accounts and Access</h2>
        <p>
          Workspace areas such as dashboards, saved ads, Swipe Files, billing, settings, and private shares require authentication. You should not share account credentials or attempt to access another user&apos;s private workspace.
        </p>
      </section>
      <section>
        <h2>Subscriptions</h2>
        <p>
          Paid access, trials, renewals, cancellations, and plan limits are governed by the plan information shown in the product and billing flow at the time of purchase or renewal.
        </p>
      </section>
      <section>
        <h2>Acceptable Use</h2>
        <p>
          You may not misuse the service, interfere with its operation, attempt to extract secrets or private data, bypass access controls, or use shared links to expose information you do not have permission to share.
        </p>
      </section>
      <section>
        <h2>Product Information</h2>
        <p>
          AdsHunting presents observable creative research information where available. It does not provide or guarantee private advertiser performance metrics.
        </p>
      </section>
    </LegalPage>
  );
}
