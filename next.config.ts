import type { NextConfig } from "next";
import { posthogUpstreams } from "./lib/posthogProxy";

const { api, assets } = posthogUpstreams();

const nextConfig: NextConfig = {
  // PostHog ingest paths use trailing slashes. Redirecting them drops events.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${assets}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${assets}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${api}/:path*`,
      },
    ];
  },
};

export default nextConfig;
