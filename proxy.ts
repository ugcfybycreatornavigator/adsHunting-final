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

const authenticatedProxy = clerkMiddleware((_auth, request) => canonicalRedirect(request));

// Local preview mode intentionally renders the workspace without an authenticated
// Clerk session. Skipping Clerk here prevents invalid or placeholder development
// keys from causing an infinite token-refresh redirect loop.
export const proxy = process.env.DEV_BYPASS_AUTH === "true"
  ? (request: NextRequest) => canonicalRedirect(request)
  : authenticatedProxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
