import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const packageDir = path.resolve(repoRoot, 'packages/interaction-builder');

console.log('=== Interaction Builder Packed Consumer Verification ===');

// Step 1: Force rebuild of package to prevent stale dist verification
console.log('\n[1/6] Rebuilding packages/interaction-builder from source...');
execSync('node build.mjs', { cwd: packageDir, stdio: 'inherit' });

// Step 2: Generate fresh npm pack tarball
console.log('\n[2/6] Packaging tarball with npm pack...');
const packOutput = execSync('npm pack', { cwd: packageDir, encoding: 'utf8' }).trim();
const tarballFilename = packOutput.split('\n').pop().trim();
const tarballPath = path.join(packageDir, tarballFilename);

if (!fs.existsSync(tarballPath)) {
  throw new Error(`Tarball not found at expected path: ${tarballPath}`);
}
console.log(`Generated tarball: ${tarballPath}`);

const tempDir = path.join(os.tmpdir(), `ib-consumer-${Date.now()}`);
fs.mkdirSync(tempDir, { recursive: true });
console.log(`\n[3/6] Setting up isolated consumer directory: ${tempDir}`);

try {
  // Step 3: Scaffold consumer package.json and tsconfig.json
  const consumerPackageJson = {
    name: 'verified-external-consumer',
    version: '1.0.0',
    type: 'module',
    private: true,
  };
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(consumerPackageJson, null, 2),
    'utf8'
  );

  const consumerTsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      skipLibCheck: true,
      types: ['node', 'react', 'react-dom'],
      outDir: './dist',
    },
    include: ['./consumer.tsx'],
  };
  fs.writeFileSync(
    path.join(tempDir, 'tsconfig.json'),
    JSON.stringify(consumerTsConfig, null, 2),
    'utf8'
  );

  console.log('Installing packed tarball, peer dependencies (react, pg), and typescript in isolated consumer...');
  execSync(
    `npm install "${tarballPath}" react react-dom zod typescript @types/react @types/react-dom @types/node pg @types/pg --no-package-lock`,
    { cwd: tempDir, stdio: 'inherit' }
  );

  // Verify 'use client' directive on installed React bundle
  const installedReactBundle = path.join(tempDir, 'node_modules/interaction-builder/dist/react/index.js');
  const installedReactContent = fs.readFileSync(installedReactBundle, 'utf8');
  if (!installedReactContent.startsWith("'use client'")) {
    throw new Error("'use client' directive missing from installed interaction-builder/react export!");
  }
  console.log("-> 'use client' directive verified in installed package React bundle.");

  // Step 4: Write comprehensive consumer code exercising all public subpaths and behaviors
  const consumerCode = `
import React from 'react';
import { renderToString } from 'react-dom/server';

// 1. Verify all public subpath imports
import * as ibMain from 'interaction-builder';
import {
  entityRefSchema,
  actionEnvelopeSchema,
  changeReceiptSchema,
  reduceInteraction,
} from 'interaction-builder/core';
import {
  createMemoryInteractionRepository,
  createInteractionHandlers,
  runAssistantTurn,
} from 'interaction-builder/runtime';
import { createInteractionStore } from 'interaction-builder/client';
import {
  InteractionProvider,
  useWorkspaceView,
  useWorkspaceMessages,
  useSendMessage,
  useDispatchAction,
} from 'interaction-builder/react';
import { createPgInteractionRepository } from 'interaction-builder/adapters/pg';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import {
  agendaDomain,
  sampleAgenda,
  type AgendaWorkspace,
  type AgendaAction,
  createScriptedModelAdapter,
} from 'interaction-builder/testkit';

console.log('-> Subpath exports successfully loaded in consumer.');

// 3. Verify PostgreSQL adapter construction in Node ESM (Defect 3)
const pgRepoConnectionString = createPgInteractionRepository({
  connectionString: 'postgresql://testuser:testpass@localhost:5432/unused_db',
});
if (typeof pgRepoConnectionString.commitAction !== 'function') {
  throw new Error('pgRepoConnectionString failed to instantiate properly.');
}
console.log('-> PostgreSQL adapter instantiated from connectionString without dynamic require error.');

const mockPool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
};
const pgRepoInjectedPool = createPgInteractionRepository({ pool: mockPool as any });
if (typeof pgRepoInjectedPool.createWorkspace !== 'function') {
  throw new Error('pgRepoInjectedPool failed to instantiate properly.');
}
console.log('-> PostgreSQL adapter instantiated from injected pool.');

// 4. Exercise full roundtrip with Memory repo, domain, runner, replay, and proposals
async function runVerification() {
  const repo = createMemoryInteractionRepository();
  const wsId = '00000000-0000-4000-8000-000000000001';
  const ownerId = 'consumer-user-1';

  // Create workspace
  const ws = await repo.createWorkspace({
    id: wsId,
    ownerId,
    domainId: 'agenda',
    domainVersion: 1,
    initialSnapshot: sampleAgenda,
  });
  console.log('-> Workspace created at revision', ws.revision);

  // Append user message
  await repo.appendMessage({
    workspaceId: wsId,
    ownerId,
    id: '00000000-0000-4000-8000-000000000002',
    role: 'user',
    parts: [{ type: 'text', text: 'Rename meeting to Annual Strategy Summit' }],
  });

  // Schedule and claim run
  const run = await repo.scheduleRun({ workspaceId: wsId, ownerId });
  const claimed = await repo.claimRun({
    workspaceId: wsId,
    leaseOwner: 'consumer-worker',
    leaseToken: 'token-consumer-1',
    leaseDurationMs: 30000,
  });

  // Execute assistant turn with scripted model adapter
  const model = createScriptedModelAdapter([
    {
      toolCalls: [
        {
          toolName: 'set_meeting_title',
          input: { title: 'Annual Strategy Summit' },
        },
      ],
    },
    {
      text: 'Meeting renamed to Annual Strategy Summit.',
    },
  ]);

  const tools = {
    set_meeting_title: {
      description: 'Set meeting title',
      parameters: { type: 'object' },
      execute: async (args: any) => {
        return repo.commitAction({
          workspaceId: wsId,
          ownerId,
          expectedRevision: 0,
          envelope: {
            actionId: '00000000-0000-4000-8000-000000000003',
            workspaceId: wsId,
            expectedRevision: 0,
            entityVersions: [],
            action: { type: 'set_meeting_title', title: args.title },
          },
          plan: agendaDomain.plan,
        });
      },
    },
  };

  const runResult = await runAssistantTurn({
    workspaceId: wsId,
    ownerId,
    repo,
    domain: agendaDomain,
    model,
    createTools: () => tools,
    runId: run.id,
    leaseToken: claimed?.leaseToken ?? 'token-consumer-1',
  });

  if (!runResult.success) throw new Error('Assistant turn failed');
  console.log('-> Model assistant turn completed and committed action.');

  const wsAfterTurn = await repo.loadWorkspace<AgendaWorkspace>({ workspaceId: wsId, ownerId });
  if (wsAfterTurn?.revision !== 1 || wsAfterTurn.snapshot.meetingTitle !== 'Annual Strategy Summit') {
    throw new Error('Workspace snapshot was not updated correctly by assistant');
  }

  // Verify stale revision conflict rejection (STALE_WORKSPACE)
  let rejected = false;
  try {
    await repo.commitAction({
      workspaceId: wsId,
      ownerId,
      expectedRevision: 0, // Stale! Current revision is 1
      envelope: {
        actionId: '00000000-0000-4000-8000-000000000004',
        workspaceId: wsId,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'set_meeting_title', title: 'Conflicting Edit' },
      },
      plan: agendaDomain.plan,
    });
  } catch (err: any) {
    if (err.message === 'STALE_WORKSPACE') rejected = true;
  }
  if (!rejected) throw new Error('Stale revision edit was not rejected with STALE_WORKSPACE');
  console.log('-> Stale workspace conflict successfully detected and rejected.');

  // Verify proposals lifecycle
  const proposal = await repo.createProposal({
    workspaceId: wsId,
    ownerId,
    actionPayload: { type: 'set_meeting_title', title: 'Proposed Title' },
    summary: 'Change meeting title to Proposed Title',
  });
  if (proposal.state !== 'pending') throw new Error('Proposal state is not pending');
  console.log('-> Proposal created in pending state.');

  // 5. Mount React component in consumer using renderToString
  function TestApp() {
    return (
      <InteractionProvider workspaceId={wsId} initialView={wsAfterTurn!.snapshot}>
        <div id="test-root">
          <h1>{wsAfterTurn!.snapshot.meetingTitle}</h1>
        </div>
      </InteractionProvider>
    );
  }

  const renderedHtml = renderToString(<TestApp />);
  if (!renderedHtml.includes('Annual Strategy Summit')) {
    throw new Error('Rendered HTML did not contain expected meeting title');
  }
  console.log('-> React component tree rendered to string (' + renderedHtml.length + ' chars).');

  console.log('\\n*** Packed consumer verification PASSED ***');
}

await runVerification();
`;

  fs.writeFileSync(path.join(tempDir, 'consumer.tsx'), consumerCode, 'utf8');

  // Step 5: TypeScript Compilation in Consumer
  console.log('\n[4/6] Verifying consumer TypeScript declarations via tsc...');
  execSync('npx tsc --noEmit', { cwd: tempDir, stdio: 'inherit' });
  console.log('TypeScript declaration verification passed with exit code 0.');

  // Step 6: Execute compiled/transpiled consumer code
  console.log('\n[5/6] Compiling consumer TS to JS...');
  execSync('npx tsc', { cwd: tempDir, stdio: 'inherit' });

  console.log('\n[6/6] Executing compiled consumer code with node...');
  execSync('node dist/consumer.js', { cwd: tempDir, stdio: 'inherit' });

  console.log('\n=== Verification Summary ===');
  console.log('VERIFIED:');
  console.log('  [x] Fresh package build and npm pack tarball generation');
  console.log('  [x] Installation of tarball in clean external environment');
  console.log('  [x] TypeScript declaration types across all public subpaths');
  console.log("  [x] 'use client' boundary preserved in built React export");
  console.log('  [x] PostgreSQL adapter ESM construction from connectionString (no dynamic require)');
  console.log('  [x] PostgreSQL adapter ESM construction from injected pool');
  console.log('  [x] Action commit -> model context -> model tool execution');
  console.log('  [x] Stale revision conflict rejection (STALE_WORKSPACE)');
  console.log('  [x] Proposals creation in pending state');
  console.log('  [x] React InteractionProvider mounting with renderToString');
  console.log('NOTE: Real PostgreSQL concurrency/fencing against live server was NOT executed');
  console.log('      in this packed test (runs in memory/constructor mock mode).');
} finally {
  console.log('\nCleaning up temporary consumer environment...');
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('Removed temporary directory:', tempDir);
  } catch (err) {
    console.warn('Could not remove temp directory:', err.message);
  }
  try {
    if (fs.existsSync(tarballPath)) {
      fs.unlinkSync(tarballPath);
      console.log('Removed generated tarball:', tarballPath);
    }
  } catch (err) {
    console.warn('Could not remove tarball:', err.message);
  }
}
