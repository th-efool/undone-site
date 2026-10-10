import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const workspace = process.cwd();
const root = path.join(workspace, '.tmp/phase4-comparison');
const baseline = '33660b2';
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'src/client/screens/cohortCreation'], { encoding: 'utf8' }).trim().split('\n').filter(file => !file.includes('/__tests__/'));
for (const file of files) {
  const output = path.join(root, 'baseline', file); mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, execFileSync('git', ['show', `${baseline}:${file}`]));
}
mkdirSync(root, { recursive: true });
writeFileSync(path.join(root, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creation visual fixture</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
writeFileSync(path.join(root, 'main.tsx'), `import {createRoot} from 'react-dom/client';
import {CreationExperience as Before} from './baseline/src/client/screens/cohortCreation/CreationExperience';
import {CreationExperience as Current} from '/@fs/${workspace.replaceAll('\\', '/')}/src/client/screens/cohortCreation/CreationExperience.tsx';
import {draftId} from '@/src/shared/cohort-creation/__tests__/fixtures';
import {conceptPreview,chunkPreview,reviewResponse} from '/@fs/${workspace.replaceAll('\\', '/')}/scripts/creation-visual/fixtures.ts';
import '@/src/app/styles/reset.css'; import './fonts.css';
window.__creationVisualFixtures={conceptPreview,chunkPreview,reviewResponse};
const Component=new URLSearchParams(location.search).get('version')==='before'?Before:Current;
createRoot(document.getElementById('root')!).render(<Component draftId={draftId} resume />);`);
writeFileSync(path.join(root, 'fonts.css'), `@font-face{font-family:Manrope;src:url('/fonts/Manrope-Medium.ttf');font-weight:400 600} @font-face{font-family:Manrope;src:url('/fonts/Manrope-Bold.ttf');font-weight:700 900} @font-face{font-family:Caveat;src:url('/fonts/Caveat-Bold.ttf')} @font-face{font-family:Playfair;src:url('/preview-playfair.woff2');font-weight:400 900} :root{--font-manrope-next:Manrope;--font-geist-sans:Manrope;--font-caveat-next:Caveat;--font-playfair-display:Playfair} body{margin:0}`);
const font = path.join(workspace, '.next/static/media/2a65768255d6b625-s.p.3u4lli0-axodc.woff2');
if (!existsSync(font)) throw new Error('Cached production Playfair font missing; build the app before visual captures.');
const fixture = path.join(workspace, 'scripts/creation-visual/fixtures.ts');
const wrapper = path.join(workspace, 'scripts/creation-visual/wrappers.tsx');
const server = await createServer({ configFile: false, root, publicDir: path.join(workspace, 'public'), esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': workspace, 'next/image': wrapper, 'next/navigation': wrapper } },
  plugins: [{ name: 'creation-fixture-boundary', enforce: 'pre', resolveId(source, importer) {
    if (source === './hooks/useCreation' && importer?.replaceAll('\\', '/').endsWith('/CreationExperience.tsx')) return fixture;
    if (source === 'next/link') return '\0preview-link';
  }, load(id) { if (id === '\0preview-link') return `export {Link as default} from ${JSON.stringify(wrapper.replaceAll('\\', '/'))};`; },
    configureServer(app) { app.middlewares.use('/preview-playfair.woff2', (_request, response) => { response.setHeader('Content-Type', 'font/woff2'); response.end(readFileSync(font)); }); } }],
  server: { host: '127.0.0.1', port: 4175, strictPort: true, fs: { allow: [workspace] } } });
await server.listen(); server.printUrls();
