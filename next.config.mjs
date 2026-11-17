/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow opening the dev server from other devices on the LAN (phone, etc.)
  allowedDevOrigins: ["192.168.31.108", "192.168.*.*"],
};

export default nextConfig;
