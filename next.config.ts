import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["simple-git", "@prisma/client"],
};

export default nextConfig;
