import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal/LegalPage";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Privacy Policy",
  description:
    "Review the AdsHunting privacy policy, including product data, account data, billing, and creative research handling.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 22, 2026">
      <section>
        <h2>Overview</h2>
        <p>
          AdsHunting is a web application for ad intelligence and creative research. This policy explains the categories of information handled by the product and how that information is used to operate the service.
        </p>
      </section>
      <section>
        <h2>Information We Process</h2>
        <p>
          AdsHunting may process account information, authentication information, subscription and billing status, product usage activity, saved research organization, shared-ad link settings, and observable advertising creative information needed to provide the workflow.
        </p>
      </section>
      <section>
        <h2>How Information Is Used</h2>
        <p>
          Information is used to provide authentication, workspace access, billing, search, saved ads, Swipe Files, shared links, product support, abuse prevention, and service reliability.
        </p>
      </section>
      <section>
        <h2>Creative Research Data</h2>
        <p>
          AdsHunting focuses on observable ad and creative information from supported sources. It does not claim access to private advertiser metrics such as ROAS, CTR, CPC, sales, revenue, or conversion data.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy can be sent through the AdsHunting contact page.
        </p>
      </section>
    </LegalPage>
  );
}
