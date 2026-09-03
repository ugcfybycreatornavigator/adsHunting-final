import { ReactNode } from "react";
import { SettingsNav } from "@/components/settings-nav";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE CONTROLS"
        title="Settings"
        description="Manage your account, workspace, integrations and privacy."
      />
      <div className="mt-8 flex flex-col md:flex-row gap-8 max-w-[1050px]">
        <SettingsNav />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </>
  );
}
