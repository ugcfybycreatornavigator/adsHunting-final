import { SettingsGeneral } from "@/components/settings-general";

export const metadata = { title: "Settings" };

export default function GeneralSettingsPage() {
  return (
    <div className="max-w-[760px] space-y-6">
      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-[#18181B]">General</h2>
        <p className="mt-1 text-[14px] text-[#71717A]">Manage your personal profile and session.</p>
      </div>
      <SettingsGeneral />
    </div>
  );
}
