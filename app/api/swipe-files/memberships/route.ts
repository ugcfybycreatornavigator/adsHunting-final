import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdSwipeFileMemberships } from "@/lib/swipe-files";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

  const { searchParams } = new URL(req.url);
  const adId = searchParams.get("adId");
  const externalAdId = searchParams.get("externalAdId");
  
  if (!adId && !externalAdId) return NextResponse.json({ error: "Missing adId or externalAdId" }, { status: 400 });

  let resolvedAdId: string | null = null;
  if (adId && uuidPattern.test(adId)) {
    const { data: internalRow } = await auth.supabase!.from("ads").select("id").eq("id", adId).maybeSingle();
    resolvedAdId = internalRow?.id ?? null;
  }

  if (!resolvedAdId) {
    const externalCandidate = externalAdId || adId;
    const { data: adRow } = await auth.supabase!.from("ads").select("id").eq("external_ad_id", externalCandidate).maybeSingle();
    resolvedAdId = adRow?.id ?? null;
  }

  if (!resolvedAdId) return NextResponse.json([]); // Not in catalog yet, so definitely not in a swipe file

  try {
    const memberships = await getAdSwipeFileMemberships(auth.supabase!, auth.userId, resolvedAdId);
    return NextResponse.json(memberships);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
