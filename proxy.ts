import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { SEO } from "@/lib/seo";

export const proxy = clerkMiddleware((_auth, request) => {
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
