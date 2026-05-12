/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kroger/db", "@kroger/shared", "@kroger/crypto"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
