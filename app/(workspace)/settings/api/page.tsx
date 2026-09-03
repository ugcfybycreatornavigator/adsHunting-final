import { Card } from "@/components/ui";
import { Webhook } from "lucide-react";

export const metadata = { title: "API Settings" };

export default function ApiSettingsPage() {
  return (
    <div className="max-w-[760px] space-y-6">
      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-[#18181B]">Developer API</h2>
        <p className="mt-1 text-[14px] text-[#71717A]">Access AdsHunting programmatically to build custom workflows.</p>
      </div>

      <Card className="p-10 shadow-sm border border-[#E1E1E1] rounded-[12px] flex flex-col items-center justify-center text-center">
        <div className="size-12 rounded-full bg-[#F4F4F5] border border-[#E1E1E1] flex items-center justify-center mb-4">
          <Webhook size={24} className="text-[#71717A]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#18181B]">Developer API is coming soon</h3>
        <p className="mt-2 text-[14px] text-[#71717A] max-w-md">
          We&apos;re building a comprehensive API that will allow you to query ads, manage Swipe Files, and integrate AdsHunting data into your own applications.
        </p>
        <div className="mt-6 px-3 py-1.5 rounded-[6px] bg-[#F4F4F5] border border-[#E1E1E1] text-[13px] font-medium text-[#71717A]">
          Coming soon
        </div>
      </Card>
    </div>
  );
}
