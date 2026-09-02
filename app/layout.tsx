import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import {
  SEO,
  absoluteUrl,
  createMetadata,
  jsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  ...createMetadata({
    title: SEO.title,
    description: SEO.description,
    path: "/",
  }),
  metadataBase: new URL(SEO.url),
  title: {
    default: SEO.title,
    template: `%s · ${BRAND.name}`,
  },
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name, url: SEO.url }],
  creator: BRAND.name,
  publisher: BRAND.name,
  category: "Ad Intelligence Software",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en">
        <body>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                "@context": "https://schema.org",
                "@graph": [organizationJsonLd(), softwareApplicationJsonLd()],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLd({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": `${SEO.url}/#website`,
                name: BRAND.name,
                url: SEO.url,
                description: SEO.description,
                publisher: { "@id": `${SEO.url}/#organization` },
                image: absoluteUrl(SEO.socialImagePath),
              }),
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
