/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@google/earthengine"],
  /**
   * Dev client: disable splitChunks so the command map’s lib/* factories are
   * not left in the page chunk while the async map chunk still requires them
   * (webpack then throws `Cannot read properties of undefined (reading 'call')`).
   */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
        runtimeChunk: false,
      };
    }
    return config;
  },
  /**
   * Firebase Hosting CDN caches Cloud Run responses using Cache-Control.
   * Next's default s-maxage (~1y) left ugnaiph.com stuck on stale HTML/CSS.
   * Keep hashed /_next/static long-lived; keep document HTML fresh.
   */
  async redirects() {
    return [
      {
        source: "/command",
        destination: "/admin/overview",
        permanent: true,
      },
      {
        source: "/command/:path*",
        destination: "/admin/:path*",
        permanent: true,
      },
      {
        source: "/overview",
        destination: "/admin/overview",
        permanent: true,
      },
      {
        source: "/overview/:path*",
        destination: "/admin/:path*",
        permanent: true,
      },
    ];
  },
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
