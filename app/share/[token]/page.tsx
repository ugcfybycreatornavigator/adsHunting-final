import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { SharedAdsViewer } from "./shared-ads-viewer";
import { EmptyState, Badge } from "@/components/ui";
import { FolderHeart, Lock, ShieldCheck } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { BRAND } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrandMark } from "@/components/brand-mark";
import { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("shared_ad_links")
    .select("visibility, name")
    .eq("token_hash", token)
    .single();

  if (!link) {
    return createMetadata({
      title: "Shared Creative",
      description: "Shared AdsHunting creative link.",
      path: `/share/${token}`,
      noIndex: true,
    });
  }

  if (link.visibility === "private" || !link.visibility) {
    return createMetadata({
      title: "Private creative shared via AdsHunting",
      description: "Sign in to view this private AdsHunting creative link.",
      path: `/share/${token}`,
      noIndex: true,
    });
  }

  return createMetadata({
    title: `${link.name || "Creative"} shared via AdsHunting`,
    description: "Shared AdsHunting creative research link.",
    path: `/share/${token}`,
    noIndex: true,
  });
}

export default async function SharedAdPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  // Use admin client to look up the token safely since RLS protects the table from non-owners
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("shared_ad_links")
    .select(`
      id, name, message, expires_at, revoked_at, visibility, created_at,
      items:shared_ad_items(ad_id, position)
    `)
    .eq("token_hash", token)
    .single();

  if (linkError || !link) {
    return <InvalidShareState title="This shared link doesn't exist." />;
  }
  
  if (link.revoked_at) {
    return <InvalidShareState title="This shared link is no longer available." />;
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return <InvalidShareState title="This shared link has expired." />;
  }

  let viewerUserId = null;
  const isPrivate = link.visibility === "private" || !link.visibility; // default to private if missing

  if (isPrivate) {
    const auth = await requireUser();
    if (auth.error || !auth.user) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[#F6F7F9]">
          <header className="flex h-16 items-center justify-between border-b border-line bg-white px-6">
            <BrandMark />
            <Badge tone="dark">Private</Badge>
          </header>
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-[16px] border border-line bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-6 grid size-12 place-items-center rounded-full bg-zinc-50 border border-line text-ink">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-semibold text-ink">Private creative</h2>
              <p className="mt-2 text-sm text-muted">This creative was shared privately.<br/>Sign in to AdsHunting to view it.</p>
              <div className="mt-8 space-y-3">
                 <Link href={`/sign-in?redirect_url=/share/${token}`} className="flex h-11 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong">
                   Sign in
                 </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }
    viewerUserId = auth.userId;
  }

  // Record access event asynchronously
  if (viewerUserId || !isPrivate) {
    admin.from("shared_ad_access_events").insert({
      shared_link_id: link.id,
      viewer_user_id: viewerUserId,
      event_type: "opened"
    }).then();
  }

  // Fetch the actual ads safely using the admin client since we've already authorized access
  const adIds = link.items.map((i: Record<string, unknown>) => i.ad_id as string);
  const { data: ads } = await admin
    .from("ads")
    .select("*")
    .in("id", adIds);

  const { dbAdToNormalized } = await import("@/lib/catalog");
  const safeAds = (ads || []).map(row => {
    const normalized = dbAdToNormalized(row);
    // Strip raw data to prevent leaking private provider intelligence
    delete normalized.rawData;
    return normalized;
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F6F7F9]">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 md:px-6">
        <div className="flex items-center gap-4">
          <BrandMark />
          <div className="h-5 w-px bg-line" />
          <span className="text-sm font-semibold text-ink hidden sm:inline">Shared Creative</span>
        </div>
        <div className="flex items-center gap-3">
          <CopyLinkButton token={token} />
          <Badge tone={isPrivate ? "dark" : "brand"}>{isPrivate ? "Private" : "Public"}</Badge>
        </div>
      </header>
      
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto p-4 md:p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-ink">{link.name}</h1>
            {link.message && <p className="mt-2 text-muted">{link.message}</p>}
          </div>
          
          {safeAds.length === 0 ? (
            <EmptyState
              icon={<FolderHeart />}
              title="No creatives found"
              body="This share does not contain any creatives or they were deleted."
            />
          ) : (
            <SharedAdsViewer ads={safeAds} isPrivate={isPrivate} />
          )}

          {!isPrivate && (
            <div className="mt-12 mb-8 flex flex-col items-center justify-center p-8 bg-white border border-line rounded-[16px] text-center shadow-sm">
              <h3 className="text-lg font-semibold text-ink">Research creative patterns with AdsHunting.</h3>
              <p className="mt-2 text-sm text-muted max-w-md mx-auto">Discover winning ads, save Swipe Files, and uncover what works in your industry.</p>
              <Link href="/" className="mt-6 flex h-11 items-center justify-center rounded-lg bg-brand px-6 font-semibold text-white transition hover:bg-brand-strong">
                Explore AdsHunting
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-line bg-white py-6 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted">
          <ShieldCheck size={14} /> Shared via {BRAND.name}
        </p>
      </footer>
    </div>
  );
}

function InvalidShareState({ title }: { title: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F6F7F9] p-4">
      <BrandMark className="mb-8" />
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">Please contact the owner if you believe this is an error.</p>
    </div>
  );
}
