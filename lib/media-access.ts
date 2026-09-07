import "server-only";

import type { NormalizedAd } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "ad-creatives";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function storagePath(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export async function signArchivedMediaUrls(values: string[]): Promise<Map<string, string>> {
  const entries = values.flatMap((value) => {
    const path = storagePath(value);
    return path ? [{ value, path }] : [];
  });
  const paths = [...new Set(entries.map(({ path }) => path))];
  if (!paths.length) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[MediaAccess] Unable to sign archived creative media.", error);
    return new Map();
  }

  const signedByPath = new Map(data.flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  return new Map(entries.flatMap(({ value, path }) => {
    const signedUrl = signedByPath.get(path);
    return signedUrl ? [[value, signedUrl] as const] : [];
  }));
}

export async function signArchivedAdMedia(ads: NormalizedAd[]): Promise<NormalizedAd[]> {
  const urls = ads.flatMap((ad) => [
    ad.creative.imageUrl,
    ad.creative.videoUrl,
    ad.creative.thumbnailUrl,
    ...(ad.creative.carouselItems || []).flatMap((item) => [
      item.imageUrl,
      item.videoUrl,
    ]),
  ]).filter((value): value is string => Boolean(value));
  const signedByUrl = await signArchivedMediaUrls(urls);
  const sign = (value?: string | null) => {
    return value ? signedByUrl.get(value) || value : null;
  };

  return ads.map((ad) => ({
    ...ad,
    creative: {
      ...ad.creative,
      imageUrl: sign(ad.creative.imageUrl),
      videoUrl: sign(ad.creative.videoUrl),
      thumbnailUrl: sign(ad.creative.thumbnailUrl),
      carouselItems: (ad.creative.carouselItems || []).map((item) => ({
        ...item,
        imageUrl: sign(item.imageUrl) || undefined,
        videoUrl: sign(item.videoUrl) || undefined,
      })),
    },
  }));
}
