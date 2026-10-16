import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const workspace = process.cwd();
const root = path.join(workspace, '.tmp/phase4-comparison');
for (const [folder, baseline] of [['baseline', '33660b2'], ['repair-baseline', '1b64f1d']]) {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'src/client/screens/cohortCreation'], { encoding: 'utf8' }).trim().split('\n').filter(file => !file.includes('/__tests__/'));
  for (const file of files) {
    const output = path.join(root, folder, file); mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, execFileSync('git', ['show', `${baseline}:${file}`]));
  }
}
mkdirSync(root, { recursive: true });
writeFileSync(path.join(root, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Creation visual fixture</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
// Measurable iframe viewports when the browser's outer viewport override is unavailable.
// These pages are isolated rendering fixtures, not application routes or live AI journeys.
for (const [name, width, height, shortTitles] of [['desktop', 1586, 992, false], ['mobile', 390, 844, false], ['desktop-short', 1586, 992, true], ['mobile-short', 390, 844, true]]) {
  writeFileSync(path.join(root, `${name}-frame.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chunking ${name} embedded-frame fixture</title><style>html,body{margin:0;width:${width}px;height:${height}px}iframe{display:block;border:0;width:${width}px;height:${height}px}</style></head><body><iframe title="Chunking ${width} by ${height} fixture viewport" src="/?screen=6&amp;source=playlist&amp;version=after&amp;preview-data=1${shortTitles ? '&amp;titles=short' : ''}"></iframe></body></html>`);
}
writeFileSync(path.join(root, 'main.tsx'), `import {createRoot} from 'react-dom/client';
import {CreationExperience as Before} from './baseline/src/client/screens/cohortCreation/CreationExperience';
import {CreationExperience as RepairBefore} from './repair-baseline/src/client/screens/cohortCreation/CreationExperience';
import {CreationExperience as Current} from '/@fs/${workspace.replaceAll('\\', '/')}/src/client/screens/cohortCreation/CreationExperience.tsx';
import {CohortIntakeScreen} from '/@fs/${workspace.replaceAll('\\', '/')}/src/client/screens/cohortBuilder/CohortIntakeScreen.tsx';
import {CohortInteractionScreen} from '/@fs/${workspace.replaceAll('\\', '/')}/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx';
import {MockInteractionContext} from '/@fs/${workspace.replaceAll('\\', '/')}/scripts/creation-visual/mock-interaction.tsx';
import {
  builderIntakeDraft,
  builderWorkspaceEmpty,
  builderWorkspaceProcessing,
  builderWorkspaceCurriculum,
  builderWorkspaceReview,
  builderWorkspaceRecommendations,
  builderWorkspaceStartingPoint,
  builderWorkspaceMaterialInput,
  builderWorkspaceReady,
  builderWorkspacePublished,
  builderMaterialMessages,
  builderChatMessages,
} from '/@fs/${workspace.replaceAll('\\', '/')}/scripts/creation-visual/builder-fixtures.ts';
import { saveIntakeDraft } from '/@fs/${workspace.replaceAll('\\', '/')}/src/client/screens/cohortBuilder/intake-draft.ts';
import {draftId} from '@/src/shared/cohort-creation/__tests__/fixtures';
import {conceptPreview,chunkPreview,analysisPreview,reviewResponse,visualActions} from '/@fs/${workspace.replaceAll('\\', '/')}/scripts/creation-visual/fixtures.ts';
import '@/src/app/styles/reset.css'; import './fonts.css';
window.__creationVisualFixtures={conceptPreview,chunkPreview,analysisPreview,reviewResponse,visualActions};
if(new URLSearchParams(location.search).has('journey')) window.__creationJourney=await import('/@fs/${workspace.replaceAll('\\', '/')}/scripts/creation-visual/journey-fixtures.ts');
const params = new URLSearchParams(location.search);
const app = params.get('app') || 'legacy';
const theme = params.get('theme') || localStorage.getItem('undone_theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);
localStorage.setItem('undone_theme', theme);

const rootEl = document.getElementById('root')!;
if (app === 'builder') {
  const screen = params.get('screen') || 'curriculum';
  if (screen === 'intake') {
    saveIntakeDraft(builderIntakeDraft, 'owner-test');
    createRoot(rootEl).render(<CohortIntakeScreen ownerId="owner-test" enabled={true} />);
  } else if (screen === 'intake-disabled') {
    saveIntakeDraft(builderIntakeDraft, 'owner-test');
    createRoot(rootEl).render(<CohortIntakeScreen ownerId="owner-test" enabled={false} />);
  } else if (screen === 'recommendations') {
    const recMessages = [
      {
        id: 'msg-rec-1',
        role: 'user',
        parts: [{ type: 'text', text: 'I want to learn distributed systems and consensus.' }],
        createdAt: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: 'msg-rec-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Got it. You’re looking to learn distributed systems. I found a few existing SideQuests that might be a good fit.' }],
        createdAt: new Date().toISOString(),
      },
    ];
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceRecommendations, revision: 1, messages: recMessages }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceRecommendations} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'starting_point' || screen === 'starting-point') {
    const startingMessages = [
      {
        id: 'msg-sp-1',
        role: 'user',
        parts: [{ type: 'text', text: 'I’ll create my own instead.' }],
        createdAt: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: 'msg-sp-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Sure. Let’s make something that fits what you actually want.' }],
        createdAt: new Date().toISOString(),
      },
    ];
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceStartingPoint, revision: 1, messages: startingMessages }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceStartingPoint} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'material_input' || screen === 'material-input' || screen === 'materials') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceMaterialInput, revision: 1, messages: builderMaterialMessages }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceMaterialInput} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'source-selection') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceEmpty, revision: 1, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceEmpty} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'processing' || screen === 'chunking') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceProcessing, revision: 2, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceProcessing} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'understanding') {
    const wsUnderstanding = {
      ...builderWorkspaceProcessing,
      processing: {
        ...builderWorkspaceProcessing.processing,
        stage: 'understanding',
        jobs: [{ id: 'job-1', sourceId: 'source-1', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: false }],
      },
    };
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: wsUnderstanding, revision: 2, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={wsUnderstanding} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'analysis' || screen === 'analyzing') {
    const wsAnalysis = {
      ...builderWorkspaceProcessing,
      processing: {
        ...builderWorkspaceProcessing.processing,
        stage: 'analysis',
        jobs: [
          { id: 'job-1', sourceId: 'source-1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-2', sourceId: 'source-1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-3', sourceId: 'source-1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: false },
        ],
      },
    };
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: wsAnalysis, revision: 2, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={wsAnalysis} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'ready') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceReady, revision: 2, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceReady} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'review') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceReview, revision: 3, messages: builderChatMessages }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceReview} />
      </MockInteractionContext.Provider>
    );
  } else if (screen === 'published') {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspacePublished, revision: 3, messages: [] }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspacePublished} />
      </MockInteractionContext.Provider>
    );
  } else {
    createRoot(rootEl).render(
      <MockInteractionContext.Provider value={{ view: builderWorkspaceCurriculum, revision: 3, messages: builderChatMessages }}>
        <CohortInteractionScreen workspaceId="ws-fixture" ownerId="owner-test" initialView={builderWorkspaceCurriculum} />
      </MockInteractionContext.Provider>
    );
  }
} else {
  const version = params.get('version');
  const Component = version === 'before' ? Before : version === 'repair-before' ? RepairBefore : Current;
  createRoot(rootEl).render(<Component draftId={draftId} resume />);
}`);
writeFileSync(path.join(root, 'fonts.css'), `@font-face{font-family:Manrope;src:url('/fonts/Manrope-Medium.ttf');font-weight:400 600} @font-face{font-family:Manrope;src:url('/fonts/Manrope-Bold.ttf');font-weight:700 900} @font-face{font-family:Caveat;src:url('/fonts/Caveat-Bold.ttf')} @font-face{font-family:Playfair;src:url('/preview-playfair.woff2');font-weight:400 900} :root{--font-manrope-next:Manrope;--font-geist-sans:Manrope;--font-caveat-next:Caveat;--font-playfair-display:Playfair} body{margin:0}`);
const font = path.join(workspace, '.next/static/media/2a65768255d6b625-s.p.3u4lli0-axodc.woff2');
if (!existsSync(font)) throw new Error('Cached production Playfair font missing; build the app before visual captures.');
const fixture = path.join(workspace, 'scripts/creation-visual/fixtures.ts');
const wrapper = path.join(workspace, 'scripts/creation-visual/wrappers.tsx');
const mockInteraction = path.join(workspace, 'scripts/creation-visual/mock-interaction.tsx');
const server = await createServer({ configFile: false, root, publicDir: path.join(workspace, 'public'), esbuild: { jsx: 'automatic' },
  define: { 'process.env.NEXT_PUBLIC_API_ORIGIN': '""', 'process.env.NEXT_PUBLIC_MOBILE_BUILD': '"false"' },
  resolve: { alias: [
    { find: '@/src/client/interaction/provider', replacement: mockInteraction },
    { find: '@/src/client/interaction/hooks', replacement: mockInteraction },
    { find: 'interaction-builder/react', replacement: mockInteraction },
    { find: 'next/image', replacement: wrapper },
    { find: 'next/navigation', replacement: wrapper },
    { find: 'next-auth/react', replacement: wrapper },
    { find: 'react-icons/si', replacement: wrapper },
    { find: 'react-icons', replacement: wrapper },
    { find: '@', replacement: workspace },
  ] },
  plugins: [{ name: 'creation-fixture-boundary', enforce: 'pre', resolveId(source, importer) {
    if (source === './hooks/useCreation' && importer?.replaceAll('\\', '/').endsWith('/CreationExperience.tsx')) return fixture;
    if (source === 'next/link') return '\0preview-link';
    if (source.includes('chunkingApi')) return '\0preview-chunks';
    if (source.includes('understandingApi')) return '\0preview-understanding';
    if (source.includes('analysisApi')) return '\0preview-analysis';
    if (source.includes('reviewApi')) return '\0preview-review';
  }, load(id) {
    if (id === '\0preview-link') return `export {Link as default} from ${JSON.stringify(wrapper.replaceAll('\\', '/'))};`;
    if (id === '\0preview-chunks') return `export async function loadChunkingPreview() { return window.__creationVisualFixtures.chunkPreview; }`;
    if (id === '\0preview-understanding') return `export async function loadUnderstandingPreview() { return window.__creationVisualFixtures.conceptPreview; }`;
    if (id === '\0preview-analysis') return `export async function loadAnalysisPreview() { return window.__creationVisualFixtures.analysisPreview; }`;
    if (id === '\0preview-review') return `export async function loadReview() { return window.__creationVisualFixtures.reviewResponse; } export const reviewResponseSchema = {};`;
  },
    configureServer(app) { app.middlewares.use('/preview-playfair.woff2', (_request, response) => { response.setHeader('Content-Type', 'font/woff2'); response.end(readFileSync(font)); }); } }],
  server: { host: '127.0.0.1', port: 4175, strictPort: true, fs: { allow: [workspace] } } });
await server.listen(); server.printUrls();
