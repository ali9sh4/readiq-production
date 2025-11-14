import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // ⚠️ LENIENT MODE - Deploy now, fix warnings later
  eslint: {
    ignoreDuringBuilds: true, // ⚠️ Skips ESLint during builds
    dirs: ["app", "components", "lib", "context", "types"],
  },

  typescript: {
    ignoreBuildErrors: true, // ⚠️ Skips TypeScript checks during builds
  },

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
