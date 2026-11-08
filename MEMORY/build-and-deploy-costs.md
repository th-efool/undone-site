# Build and deployment cost boundaries

- Root npm lifecycle: `package.json` runs `prebuild` before `build`; `prebuild` builds `packages/notes-board` and `packages/interaction-builder`, and `build` runs Prisma generation before Next build.
- `scripts/postinstall.mjs` preserves workspace builds and Prisma generation for local installs. On Vercel (`VERCEL=1`) it skips those steps because the normal build lifecycle runs them, avoiding a duplicate package build and Prisma generate during install.
- `vercel.json` currently uses Vercel's detected Next.js build command; confirm Vercel continues to invoke `npm run build` before relying on the install skip in deployments.
