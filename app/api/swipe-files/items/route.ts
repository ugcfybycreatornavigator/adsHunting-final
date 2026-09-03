import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { saveAdToDefaultSwipeFile, toggleAdInSwipeFile } from "@/lib/swipe-files";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function logAdResolutionError(error: SupabaseError, operation: string, adId?: string) {
  console.error("[SwipeFiles]", {
    operation,
    adId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

async function resolveCatalogAdId(supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>["supabase"]>, adId?: string, externalAdId?: string) {
  if (adId && uuidPattern.test(adId)) {
    const { data, error } = await supabase.from("ads").select("id").eq("id", adId).maybeSingle();
    if (error) {
      logAdResolutionError(error, "resolveCatalogAdId.byInternalId", adId);
      throw new Error("Unable to resolve creative.");
    }
    if (data?.id) return data.id;
  }

  const candidateExternalId = externalAdId || adId;
  if (!candidateExternalId) return null;

  const { data, error } = await supabase.from("ads").select("id").eq("external_ad_id", candidateExternalId).maybeSingle();
  if (error) {
    logAdResolutionError(error, "resolveCatalogAdId.byExternalId", candidateExternalId);
    throw new Error("Unable to resolve creative.");
  }

  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  const auth = await requireUser();
  if (auth.error || !auth.userId) return auth.error || NextResponse.json({error: "Unauthorized"}, {status: 401});

  const { adId, externalAdId, swipeFileId } = await req.json().catch(() => ({}));
  
  if (!adId && !externalAdId) {
    return NextResponse.json({ error: "Missing adId or externalAdId" }, { status: 400 });
  }

  try {
    const resolvedAdId = await resolveCatalogAdId(auth.supabase!, adId, externalAdId);
    if (!resolvedAdId) {
      return NextResponse.json({ error: "Creative has not been persisted to the catalog yet. Please try again in a moment." }, { status: 404 });
    }

    const result = swipeFileId
      ? await toggleAdInSwipeFile(auth.supabase!, auth.userId, resolvedAdId, swipeFileId)
      : await saveAdToDefaultSwipeFile(auth.supabase!, auth.userId, resolvedAdId);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Couldn't save ad. Try again." }, { status: 500 });
  }
}
