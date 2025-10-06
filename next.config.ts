import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "content.public.markaz.app",
        pathname: "/**", // ✅ Allow all image paths from this domain
      },
    ],
  },
};

export default nextConfig;
