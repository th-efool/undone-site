import type { NextConfig } from 'next';

const isMobileBuild = process.env.MOBILE_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isMobileBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  transpilePackages: ['es-toolkit', 'mermaid', '@excalidraw/mermaid-to-excalidraw', '@excalidraw/excalidraw'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
      },
    ],
  },
};

export default nextConfig;
