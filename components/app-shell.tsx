import { Sidebar, MobileHeader } from "@/components/sidebar";
import { isSupabaseConfigured } from "@/lib/env";
import { isAnyAdsProviderConfigured } from "@/lib/env/server";
import { isPreviewMode } from "@/lib/preview";
import { SupportProvider } from "@/components/support/support-context";
import { SupportModal } from "@/components/support/SupportModal";
import { OwnerWelcomeModal } from "@/components/auth/owner-welcome-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SupportProvider>
      <div className="min-h-screen bg-[#FFFFFF] text-ink">
      <OwnerWelcomeModal />
      <Sidebar />
      <MobileHeader />
      <main className="min-h-screen min-w-0 lg:pl-[236px]">
        {isPreviewMode ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-center text-xs font-medium text-amber-900">
            Guest preview — login is temporarily disabled. Live discovery works; user saves require Supabase tables and authentication.
          </div>
        ) : (!isAnyAdsProviderConfigured || !isSupabaseConfigured) && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-center text-xs font-medium text-signal">
            Configuration mode — add valid environment values to enable {(!isAnyAdsProviderConfigured && !isSupabaseConfigured) ? "live search and persistence" : !isAnyAdsProviderConfigured ? "live provider search" : "authentication and persistence"}.
          </div>
        )}
        <div className="mx-auto min-w-0 w-full max-w-[1680px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <SupportModal />
    </div>
    </SupportProvider>
  );
}
