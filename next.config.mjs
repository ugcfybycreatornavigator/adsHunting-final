import { withSentryConfig } from "@sentry/nextjs/config";
/** @type {import('next').NextConfig} */
const nextConfig = {
  // npm scripts assign a distinct output directory to dev and production.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    qualities: [75, 100],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async redirects() {
    const redirects = [
      { source: "/faq", destination: "/resources/help", permanent: true },
      { source: "/trial", destination: "/sign-up", permanent: true },
      { source: "/signup", destination: "/sign-up", permanent: true },
    ];

    if (process.env.DEV_BYPASS_AUTH === "true") {
      redirects.push({ source: "/login", destination: "/dashboard", permanent: false });
    } else {
      redirects.push({ source: "/login", destination: "/sign-in", permanent: true });
    }

    return redirects;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "adshunting",

  project: "adshunting",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
