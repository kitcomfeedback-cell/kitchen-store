const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

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
