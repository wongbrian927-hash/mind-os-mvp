/** First-party proxy path. The browser never calls PostHog's domain directly. */
export const POSTHOG_PROXY_PATH = "/ingest";

/**
 * Map NEXT_PUBLIC_POSTHOG_HOST to the ingest API, asset host, and UI host.
 * Cloud projects use https://us.i.posthog.com or https://eu.i.posthog.com.
 */
export function posthogUpstreams(host = process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  const normalized = (host ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const eu =
    normalized.includes("eu.i.posthog.com") || normalized.includes("eu.posthog.com");
  const us =
    normalized.includes("us.i.posthog.com") || normalized.includes("us.posthog.com");
  return {
    api: eu
      ? "https://eu.i.posthog.com"
      : us
        ? "https://us.i.posthog.com"
        : normalized,
    assets: eu
      ? "https://eu-assets.i.posthog.com"
      : "https://us-assets.i.posthog.com",
    ui: eu ? "https://eu.posthog.com" : "https://us.posthog.com",
  };
}
