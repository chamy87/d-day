import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Emit sourcemaps for every client chunk so Sentry can always resolve a
  // reference (fixes "could not determine a source map reference" warnings);
  // Sentry deletes them after upload so they are never served publicly.
  productionBrowserSourceMaps: true,
};

export default withSentryConfig(nextConfig, {
  // Org/project come from SENTRY_ORG / SENTRY_PROJECT env vars once set.
  // Source map upload auth token (build-time secret, distinct from the DSN)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
    // Root-level js in the deploy output is Vercel-generated glue (our app
    // chunks live under _next/) — no user stack frames reference it, and it
    // has no sourcemap, which otherwise triggers a reference warning.
    ignore: ["*.js"],
  },

  // Upload wider set of client source files for better stack trace resolution
  widenClientFileUpload: true,

  // Proxy API route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
