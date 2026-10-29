import { withWorkflow } from 'workflow/next';
import type { NextConfig } from 'next';
import path from 'path';
import * as nextEnvModule from '@next/env';
import { loadRootEnvironment, rootPublicEnvironment } from './scripts/root-environment.mjs';

const nextEnv = (nextEnvModule as any).default ?? nextEnvModule;
const { loadEnvConfig, processEnv, updateInitialEnv, initialEnv } = nextEnv;
const loaded = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
loadRootEnvironment({ initialEnv: initialEnv ?? process.env, loadedEnvFiles: loaded.loadedEnvFiles });
updateInitialEnv(process.env);

const isMobileBuild = process.env.MOBILE_BUILD === 'true';

const nextConfig: NextConfig = {
  typescript: {
    // Dedicated verification runs separately via npx tsc --noEmit and npm run verify:vercel
    ignoreBuildErrors: true,
  },
  compress: true,
  poweredByHeader: false,
  env: rootPublicEnvironment(),
  turbopack: {
    root: path.resolve('.'),
  },
  ...(isMobileBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  serverExternalPackages: [],
  outputFileTracingIncludes: {
    '/.well-known/workflow/**': ['./src/server/domain/cohort-creation/materials/pdf-parser.worker.mjs', './node_modules/pdfjs-dist/legacy/build/**'],
  },
  transpilePackages: ['es-toolkit'],
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@reduxjs/toolkit',
      'lodash-es',
      'remeda',
      'cmdk',
      '@tanstack/react-query',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tooltip',
    ],
  },
  async headers() {
    if (isMobileBuild) {
      return [];
    }
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/(fonts|icons)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(videos|images)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: isMobileBuild,
    formats: ['image/avif', 'image/webp'],
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

const workflowConfig = withWorkflow(nextConfig);
const rootEnvironment = { ...process.env };
export default async function configure(phase: string, context: { defaultConfig: NextConfig }) {
  const isLocalDevServer = phase === 'phase-development-server' && process.env.VERCEL !== '1';
  const configured = (isMobileBuild || isLocalDevServer) ? nextConfig : await workflowConfig(phase, context);
  // Workflow compilation may reload Next environment files. Reapply root-only policy
  // after that async boundary, before Next captures public build configuration.
  const current = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
  loadRootEnvironment({ initialEnv: rootEnvironment, loadedEnvFiles: current.loadedEnvFiles });
  processEnv([], process.cwd(), console, true);
  updateInitialEnv(process.env);
  return configured;
}
