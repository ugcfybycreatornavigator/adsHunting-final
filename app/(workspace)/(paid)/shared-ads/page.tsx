import { SharedAdsManager } from "@/components/shared-ads-manager";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Shared Ads" };

export default function SharedAdsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title="Shared Ads"
        description="Manage the ads and swipe files you've shared."
      />
      <div className="mt-8">
        <SharedAdsManager />
      </div>
    </>
  );
}
