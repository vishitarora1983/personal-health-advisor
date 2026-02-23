// frontend/next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Backward Compatibility Redirects ────────────────────────────────
  // Old app routes that previously lived at root level → new /app/* routes.
  //
  // permanent: true uses HTTP 308 (Permanent Redirect, method-preserving).
  // 308 is preferred over 301 because it instructs search engines to update
  // their indexes AND browsers to cache the redirect permanently. The method
  // is preserved (POST remains POST), though these are all GET-only pages.
  //
  // These redirects are processed at the Next.js server level — before React
  // renders — so they work even for users with bookmarks to the old URLs.
  async redirects() {
    return [
      {
        source: "/profile",
        destination: "/app/profile",
        permanent: true,
      },
      {
        source: "/meal-plan",
        destination: "/app/meal-plan",
        permanent: true,
      },
      {
        source: "/tracking",
        destination: "/app/tracking",
        permanent: true,
      },
      {
        source: "/grocery",
        destination: "/app/grocery",
        permanent: true,
      },
      {
        source: "/chefs-view",
        destination: "/app/chefs-view",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/app/dashboard",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/app/settings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
