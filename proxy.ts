import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SEO } from "@/lib/seo";

function canonicalRedirect(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isCanonicalHost = host === SEO.domain;
  const isWwwHost = host === `www.${SEO.domain}`;
  const shouldRedirectHost = isWwwHost;
  const shouldRedirectProtocol = (isCanonicalHost || isWwwHost) && forwardedProto === "http";

  if (shouldRedirectHost || shouldRedirectProtocol) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = SEO.domain;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
}

// Clerk must run for every matched request, including local preview requests.
// Server components can otherwise call auth() without Clerk's request headers,
// which fails before the preview-mode guard can safely bypass authorization.
export const proxy = clerkMiddleware((_auth, request) => canonicalRedirect(request));

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
