import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@variedreach-vdr/shared'],
};

export default nextConfig;
