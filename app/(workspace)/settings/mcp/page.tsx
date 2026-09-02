import { Card } from "@/components/ui";
import { Cpu } from "lucide-react";

export const metadata = { title: "MCP Settings" };

export default function McpSettingsPage() {
  return (
    <div className="max-w-[760px] space-y-6">
      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-[#18181B]">Model Context Protocol (MCP)</h2>
        <p className="mt-1 text-[14px] text-[#71717A]">Connect AdsHunting directly to AI models like Claude or local tools.</p>
      </div>

      <Card className="p-10 shadow-sm border border-[#E1E1E1] rounded-[12px] flex flex-col items-center justify-center text-center">
        <div className="size-12 rounded-full bg-[#F4F4F5] border border-[#E1E1E1] flex items-center justify-center mb-4">
          <Cpu size={24} className="text-[#71717A]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#18181B]">MCP integration is coming soon</h3>
        <p className="mt-2 text-[14px] text-[#71717A] max-w-md">
          We&apos;re building an MCP server that will allow you to query your Swipe Files, search AdsHunting, and interact with your saved data directly from AI assistants.
        </p>
        <div className="mt-6 px-3 py-1.5 rounded-[6px] bg-[#F4F4F5] border border-[#E1E1E1] text-[13px] font-medium text-[#71717A]">
          Coming soon
        </div>
      </Card>
    </div>
  );
}
