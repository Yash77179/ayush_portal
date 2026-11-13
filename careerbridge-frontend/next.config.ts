import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // dev only: let phones / other laptops on your local network load the dev server (http://<laptop-ip>:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.trycloudflare.com"],
  // Opened from another device (a phone on your Wi-Fi, or through a tunnel), the browser can't reach Django at
  // 127.0.0.1 — so the site calls /backend/… on itself and this server passes it on to Django. One address for both.
  skipTrailingSlashRedirect: true, // Django's URLs end in "/": keep it when passing them on
  async rewrites() {
    const backend = (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "")
    return [
      { source: "/backend/:path*/", destination: `${backend}/:path*/` }, // with the trailing slash (the usual case)
      { source: "/backend/:path*", destination: `${backend}/:path*` },
    ]
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
