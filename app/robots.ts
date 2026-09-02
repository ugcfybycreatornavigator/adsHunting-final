import type { MetadataRoute } from "next";
import { absoluteUrl, SEO } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/pricing",
        "/product/",
        "/resources",
        "/resources/",
        "/about",
        "/contact",
        "/privacy",
        "/terms",
        "/icon.svg",
        "/icon.png",
        "/logo.png",
        "/opengraph-image",
      ],
      disallow: [
        "/api/",
        "/dashboard",
        "/discover",
        "/saved",
        "/swipe-files",
        "/brands",
        "/competitors",
        "/analytics",
        "/shared-ads",
        "/settings",
        "/settings/",
        "/share/",
        "/sign-in",
        "/sign-up",
        "/login",
        "/signup",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SEO.url,
  };
}
