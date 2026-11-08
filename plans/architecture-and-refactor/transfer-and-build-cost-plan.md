# Transfer and build cost optimization plan

## Evidence

- The 12-hour Vercel route table attributes 174 MB outgoing transfer primarily to `/videos/hls/segment_*.ts`.
- The video player initializes HLS on mount with `autoStartLoad: true` and the video element uses `preload="auto"`, allowing segment transfer before an explicit play action.
- Root `postinstall` runs both internal package builds and Prisma generation. `npm run build` also invokes npm's `prebuild` lifecycle and runs Prisma generation, duplicating work during deployment.

## Changes

1. Keep the HLS manifest available for fast startup, but disable HLS segment loading until Play is clicked. Set the media element to `preload="none"`; start HLS loading as part of the user's play action. Keep MP4 fallback behavior on demand.
2. Avoid duplicate build work only in Vercel's install lifecycle. Local installs must keep building workspace packages and generating Prisma artifacts as before; Vercel's `prebuild` and `build` remain the authoritative deployment build.
3. Keep all routes, media quality, video controls, and application features intact.

## Acceptance

- A page view may request the small playlist, but does not request HLS segments until the user presses Play.
- Play, pause, replay, Safari native HLS, and MP4 fallback continue to work.
- Local postinstall behavior is unchanged. Vercel does not rebuild workspace packages or regenerate Prisma before the normal build lifecycle.
- Confirm changes by inspecting source and final diff; do not run tests unless requested.
