import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Google (for avatar_url)
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
};

export default nextConfig;
