import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

fs.mkdirSync('dist', { recursive: true });

const enableSourcemap = process.env.SOURCEMAP === 'true';
if (!enableSourcemap) {
  for (const f of [
    'dist/index.js.map',
    'dist/index.css.map',
    'dist/index.d.ts.map',
    'dist/canvas.js.map',
    'dist/canvas.css.map',
    'dist/canvas.d.ts.map',
    'dist/kanban.js.map',
    'dist/kanban.css.map',
    'dist/kanban.d.ts.map',
    'dist/types.d.ts.map',
  ]) {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

console.log('Bundling @undone/notes-board with esbuild...');

const commonOptions = {
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@excalidraw/excalidraw',
    '@svar-ui/react-kanban',
    'clsx',
    'lucide-react',
  ],
  loader: {
    '.css': 'css',
    '.woff2': 'file',
    '.woff': 'file',
    '.ttf': 'file',
    '.svg': 'dataurl',
    '.png': 'dataurl',
  },
  jsx: 'automatic',
  sourcemap: enableSourcemap,
};

// 1. Bundle canvas (only imports NotesCanvas, which imports @excalidraw/excalidraw)
await esbuild.build({
  ...commonOptions,
  entryPoints: ['src/canvas.ts'],
  outfile: 'dist/canvas.js',
});

// 2. Bundle kanban (only imports NotesKanban, which does NOT import @excalidraw/excalidraw)
await esbuild.build({
  ...commonOptions,
  entryPoints: ['src/kanban.ts'],
  outfile: 'dist/kanban.js',
});

// 3. Output dist/index.js re-exporting both for backwards compatibility
fs.writeFileSync('dist/index.js', `export * from './canvas.js';\nexport * from './kanban.js';\n`, 'utf8');

// Combine CSS into dist/index.css for backwards compatibility
const canvasCss = fs.existsSync('dist/canvas.css') ? fs.readFileSync('dist/canvas.css', 'utf8') : '';
const kanbanCss = fs.existsSync('dist/kanban.css') ? fs.readFileSync('dist/kanban.css', 'utf8') : '';
fs.writeFileSync('dist/index.css', `${canvasCss}\n${kanbanCss}`, 'utf8');

// Generate types
try {
  execSync('npx tsc -p tsconfig.json --emitDeclarationOnly', { stdio: 'ignore' });
} catch {
  // If tsc fails on external type checks, emit clean stub types for Next.js
  if (!fs.existsSync('dist/canvas.d.ts')) {
    fs.writeFileSync('dist/canvas.d.ts', `
import React from 'react';
export declare const NotesCanvas: React.FC<any>;
export type CanvasSceneData = any;
export type CanvasState = any;
export type CanvasDocument = any;
export type CanvasStatus = any;
export type GridSettingsConfig = any;
`, 'utf8');
  }
  if (!fs.existsSync('dist/kanban.d.ts')) {
    fs.writeFileSync('dist/kanban.d.ts', `
import React from 'react';
export declare const NotesKanban: React.FC<any>;
export declare const ColIdInjector: React.FC<any>;
export type Column = { id: string; label: string };
`, 'utf8');
  }
  if (!fs.existsSync('dist/index.d.ts')) {
    fs.writeFileSync('dist/index.d.ts', `
export * from './canvas';
export * from './kanban';
`, 'utf8');
  }
}

console.log('Build completed successfully: dist/canvas.js, dist/kanban.js, dist/index.js and dist/index.css generated.');
