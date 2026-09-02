/** @type {import('next').NextConfig} */
const nextConfig = {
  // npm scripts assign a distinct output directory to dev and production.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async redirects() {
    const redirects = [
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

export default nextConfig;
