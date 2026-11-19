import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  serverExternalPackages: ["node-appwrite", "exceljs", "@react-pdf/renderer"],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
