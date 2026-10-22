import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the same network load the dev server's scripts (otherwise buttons do nothing).
  // Add your laptop's address here when you change network (run `ipconfig`, look for IPv4 Address).
  allowedDevOrigins: ["172.20.10.3", "10.91.66.150", "192.168.0.103"],
};

export default nextConfig;
