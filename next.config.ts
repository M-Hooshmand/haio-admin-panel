import type { NextConfig } from "next"

const BACKEND = process.env.BACKEND_API_URL ?? "https://portal.haio.ir"

const nextConfig: NextConfig = {
  output: "standalone",
  // Django's APPEND_SLASH and Next's trailing-slash redirect can ping-pong
  // through the /api rewrite (308 <-> 301), so disable the built-in redirect.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
