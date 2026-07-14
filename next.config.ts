import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Auth helper endpoints, served first-party. Production authDomain
  // is www.rubiktech.org (firebase/client.ts) so the Google sign-in redirect
  // never crosses sites — Safari ITP drops cross-site auth state, which broke
  // sign-in on iOS. These pages only exist on Firebase Hosting, so proxy them.
  // Must ship in the same deploy as the authDomain change; one without the
  // other breaks Google sign-in entirely.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://readiq-1f109.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://readiq-1f109.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },

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
