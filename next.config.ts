import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.130.99.12"],
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
