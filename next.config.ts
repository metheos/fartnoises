import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,

  // Configure headers for static files
  async headers() {
    return [
      {
        // Prevent caching of .jet files since they contain dynamic game data
        // Note: Next.js doesn't support ** patterns, so we target specific paths
        source: "/sounds/Earwax/:path*.jet",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
