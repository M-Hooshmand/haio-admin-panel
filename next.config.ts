import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Django's APPEND_SLASH and Next's trailing-slash redirect can ping-pong,
  // so disable the built-in redirect. API calls are proxied by the
  // catch-all route handler at src/app/api/v1/[...path]/route.ts.
  skipTrailingSlashRedirect: true,
}

export default nextConfig
