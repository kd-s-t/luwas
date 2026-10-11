/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /**
   * Firebase Hosting CDN caches Cloud Run responses using Cache-Control.
   * Next's default s-maxage (~1y) left luwasph.com stuck on stale HTML/CSS.
   * Keep hashed /_next/static long-lived; keep document HTML fresh.
   */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
