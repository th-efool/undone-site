# Video Explainer (Homepage Section 2) Remediation Plan

## Root Cause Summary
1. **Deadlocked Loading State Machine**: In `useHlsVideo.ts`, `isLoading` is initialized to `true` with a 400ms debounce timer triggered on `onWaiting`. When video playback pauses (via scroll out-of-bounds or user interaction), `onPause` sets `isPlaying(false)` but does not reset `isLoading`. Since the video is paused, `onCanPlay` never fires again. In `VideoControls.tsx`, `showCenterLoader = !isPlaying && isLoading && !isEnded` becomes permanently `true`, displaying an infinite loading spinner and hiding the play button (`showPlayButton = !isPlaying && !isLoading && !isEnded`).
2. **Click-Intercepting Overlay**: When `showCenterLoader` is `true`, `.overlayCenter.overlayVisible` covers the entire video container with `pointer-events: auto` without an `onClick` handler, swallowing all clicks and preventing users from clicking the video to start playback.
3. **Broken HLS Fallback & Native Safari Synchronization**: In `VideoPlayer.tsx`, `<video src={!hlsSupported ? fallbackSrc : undefined} />` leaves `src` undefined when `hlsSupported` is true. In Safari/iOS (native HLS), `useHlsVideo` sets `currentVideo.src = hlsSrc` imperatively, which conflicts with React rendering `src={undefined}`. If HLS encounters fatal errors, `hlsInstance.destroy()` is never called, causing media decoder clashes when falling back to MP4. Also, native Safari lacks an error listener to fallback to MP4.
4. **Missing HTML `muted` Attribute**: Browsers strictly require the `muted` attribute in the HTML DOM for autoplay. Without `muted` on `<video>`, browser autoplay policies reject playback immediately.
5. **Hyper-aggressive Scroll Clamping**: In `VideoExplainer.tsx`, any scroll where `progress < 0.15` or `progress > 0.82` forces `video.pause()`. If a user scrolls into Section 2 and clicks play at progress 0.05-0.14, any 1px scroll immediately force-pauses the video.
6. **Missing Poster & Preload**: The video element lacks `poster="/images/hero-poster.webp"` and `preload="auto"`, resulting in a black box before playback starts.

## Proposed Changes

### 1. `src/client/screens/landing/VideoExplainer/hooks/useHlsVideo.ts`
- Fix loading state machine:
  - Add `isBuffering` vs `isInitialLoading`.
  - When paused, if `video.readyState >= 2` (or on `onPause`), clear pending loading timers and ensure `isLoading` is `false`.
  - On HLS fatal error, call `hlsInstance.destroy()`, set `hlsSupported(false)`, set `currentVideo.src = fallbackSrc`, call `currentVideo.load()`.
  - In Safari native HLS (`canPlayType`), attach an `error` listener to `currentVideo` to fall back to `fallbackSrc` if HLS playback fails.
  - Support `fallbackSrc` in `useHlsVideo` options and handle both HLS and direct MP4 fallback cleanly.

### 2. `src/client/screens/landing/VideoExplainer/components/VideoPlayer.tsx`
- Add `poster="/images/hero-poster.webp"`.
- Add `preload="auto"`.
- Add `muted` attribute to `<video>`.
- Set `src` properly: if using native HLS in Safari, set `src={hlsSrc}`; if HLS not supported or failed, set `src={fallbackSrc}`.
- Add error handler `onError` to fall back cleanly to `fallbackSrc`.

### 3. `src/client/screens/landing/VideoExplainer/components/VideoControls.tsx`
- Decouple `showPlayButton` from being permanently blocked by `isLoading`:
  - Show the big center play button whenever the video is paused (`!isPlaying && !isEnded`).
  - Only show the center loader when unready on initial cold load before data is available (`!isPlaying && isLoading && videoNotReady`).
  - Show buffering in corner during playback (`isPlaying && isLoading`).
  - Add click handler to `.overlayCenter` so clicking anywhere on the overlay calls `togglePlay`.

### 4. `src/client/screens/landing/VideoExplainer/VideoExplainer.tsx`
- Auto-pause only when the section leaves the viewport (`progress <= 0 || progress >= 1` or via viewport intersection), NOT during normal section navigation (`0.15 - 0.82`).
- Track whether user manually started playback to avoid auto-pausing a user actively watching the explainer.
- Ensure video unmuting and replay work seamlessly.

## Verification
- Test in Chromium and Mobile viewports via Playwright MCP.
- Verify scrolling into Section 2 autoplays muted.
- Verify clicking Play unmutes and plays cleanly.
- Verify scrolling up/down does NOT get stuck in an infinite loading spinner.
- Verify manual clicking toggles play/pause accurately.
- Verify video fallback to MP4 works if HLS fails.
