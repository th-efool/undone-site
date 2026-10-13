# MEMORY: Subsystem Segregation Plan (Notes & Android Isolation)

## Objective
Isolate heavy, slow-to-install, and slow-to-compile dependencies (`@excalidraw/excalidraw`, `@svar-ui/react-kanban`, `@capacitor/*`, Android build toolchains) into dedicated local sub-packages (`packages/notes-board` and `packages/mobile`) with their own `node_modules`.

## Key Benefits
1. **AI Safety**: Deleting root `node_modules` does NOT delete `packages/notes-board/node_modules` or `packages/mobile/node_modules`.
2. **Fast Root Installs**: Root `npm install` drops from ~1.5 GB to ~800 MB, eliminating 50k+ small files.
3. **Instant Compilation**: Next.js stops transpiling Excalidraw source files on every dev startup.
4. **Single Vercel Project**: Main site continues to deploy as a single project on Vercel via automated `prebuild`.

## Architecture

### 1. `packages/notes-board`
- **Dependencies**: `@excalidraw/excalidraw`, `@svar-ui/react-kanban`, `clsx`, `lucide-react`.
- **PeerDependencies**: `react`, `react-dom`.
- **Output**: Pre-bundled ESM + types in `dist/` via `tsup`.
- **Source**:
  - `src/NotesCanvas/`
  - `src/NotesKanban/`
  - `src/index.ts`
- **Main App Usage**: Next.js dynamically imports `@undone/notes-board`.

### 2. `packages/mobile`
- **Dependencies**: `@capacitor/cli`, `@capacitor/android`, `@capacitor/core`, `@capacitor/*` plugins.
- **Contents**:
  - `android/` (Native Android Studio project)
  - `capacitor.config.ts` (configured with `webDir: '../../out'`)
  - `scripts/mobile-build.mjs`
  - `scripts/mobile-release-aab.mjs`
- **Main App Usage**: Root delegates `mobile:*` commands via `npm --prefix packages/mobile run ...`.

### 3. Root Cleanups
- Remove `mermaid` (unused, 23 MB).
- Remove `@excalidraw/mermaid-to-excalidraw` from `next.config.ts`.
- Replace single `react-icons` usage in `TextMaterial.tsx` with `lucide-react` and remove `react-icons` (84 MB).
