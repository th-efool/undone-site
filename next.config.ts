import { withWorkflow } from 'workflow/next';
import type { NextConfig } from 'next';
import path from 'path';
import { initialEnv, loadEnvConfig, processEnv, updateInitialEnv } from '@next/env';
import { loadRootEnvironment } from './scripts/root-environment.mjs';

const loaded = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
loadRootEnvironment({ initialEnv: initialEnv ?? process.env, loadedEnvFiles: loaded.loadedEnvFiles });
updateInitialEnv(process.env);

const isMobileBuild = process.env.MOBILE_BUILD === 'true';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve('.'),
  },
  ...(isMobileBuild
    ? {
        output: 'export',
        trailingSlash: true,
      }
    : {}),
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/.well-known/workflow/**': ['./src/server/domain/cohort-creation/materials/pdf-parser.worker.mjs', './node_modules/pdfjs-dist/legacy/build/**'],
  },
  transpilePackages: ['es-toolkit', 'mermaid', '@excalidraw/mermaid-to-excalidraw', '@excalidraw/excalidraw'],
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
  const configured = isMobileBuild ? nextConfig : await workflowConfig(phase, context);
  // Workflow compilation may reload Next environment files. Reapply root-only policy
  // after that async boundary, before Next captures public build configuration.
  const current = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
  loadRootEnvironment({ initialEnv: rootEnvironment, loadedEnvFiles: current.loadedEnvFiles });
  processEnv([], process.cwd(), console, true);
  updateInitialEnv(process.env);
  return configured;
}
