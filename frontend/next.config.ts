import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Silence workspace root warning caused by root package.json (concurrently)
  outputFileTracingRoot: require("path").join(__dirname, "../"),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

// Wrap with Sentry only when NEXT_PUBLIC_SENTRY_DSN is set,
// so local dev without Sentry stays fast and warning-free.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  // Dynamic import so the build doesn't fail if @sentry/nextjs isn't installed
  const { withSentryConfig } = require("@sentry/nextjs");
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
} else {
  module.exports = nextConfig;
}
