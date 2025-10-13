import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "content.public.markaz.app",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.shop.markaz.app",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
