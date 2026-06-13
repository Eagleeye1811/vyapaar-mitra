import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's internal resources (HMR websocket, RSC payloads,
  // JS chunks) to be loaded when the app is opened from a LAN IP rather than
  // localhost. Without this, Next 16 blocks those cross-origin dev requests,
  // which breaks hot-reload AND client hydration (buttons stop responding).
  // localhost / 127.0.0.1 are always allowed; add other dev hosts here.
  allowedDevOrigins: ["192.168.1.7"],
};

export default nextConfig;
