import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRootEnvironment } from './root-environment.mjs';

const directories: string[] = [];
function directory() { const cwd = mkdtempSync(path.join(tmpdir(), 'undone-root-env-')); directories.push(cwd); return cwd; }
afterEach(() => directories.splice(0).forEach(cwd => rmSync(cwd, { recursive: true, force: true })));

describe('root-only local environment', () => {
  it('preloads root values before Next captures public variables or forks workers', () => {
    const cwd = directory();
    writeFileSync(path.join(cwd, '.env'), 'MONGODB_URI=root-value\n');
    writeFileSync(path.join(cwd, '.env.local'), 'MONGODB_URI=wrong-value\nNEXT_PUBLIC_APP_URL=https://invalid.example\n');
    const nextEnv = pathToFileURL(createRequire(import.meta.url).resolve('@next/env')).href;
    const register = new URL('./register-root-environment.mjs', import.meta.url).href;
    const code = `import nextEnv from ${JSON.stringify(nextEnv)};
      nextEnv.loadEnvConfig(process.cwd(),false);
      console.log(JSON.stringify({mongo:process.env.MONGODB_URI,variant:process.env.NEXT_PUBLIC_APP_URL}));`;
    const child = spawnSync(process.execPath, ['--import', register, '--input-type=module', '-e', code], {
      cwd, encoding: 'utf8', timeout: 10_000, env: { NODE_ENV: 'production', SystemRoot: process.env.SystemRoot },
    });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({ mongo: 'root-value' });
  });
  it('cleans actual Next.js loading precedence in a separate process', () => {
    const cwd = directory();
    writeFileSync(path.join(cwd, '.env'), 'MONGODB_URI=root-value\n');
    writeFileSync(path.join(cwd, '.env.local'), 'MONGODB_URI=wrong-value\nVARIANT_ONLY=wrong\n');
    const nextEnv = pathToFileURL(createRequire(import.meta.url).resolve('@next/env')).href;
    const loader = new URL('./root-environment.mjs', import.meta.url).href;
    const code = `import nextEnv from ${JSON.stringify(nextEnv)};
      import {loadRootEnvironment} from ${JSON.stringify(loader)};
      const loaded=nextEnv.loadEnvConfig(process.cwd(),false);
      if(process.env.MONGODB_URI!=='wrong-value') throw new Error('Fixture did not exercise precedence');
      loadRootEnvironment({initialEnv:nextEnv.initialEnv,loadedEnvFiles:loaded.loadedEnvFiles});
      nextEnv.updateInitialEnv(process.env);
      nextEnv.resetEnv();
      console.log(JSON.stringify({mongo:process.env.MONGODB_URI,variant:process.env.VARIANT_ONLY,shell:process.env.DEPLOYMENT_KEY}));`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd, encoding: 'utf8', timeout: 10_000,
      env: { NODE_ENV: 'production', SystemRoot: process.env.SystemRoot, DEPLOYMENT_KEY: 'hosted-value' },
    });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({ mongo: 'root-value', shell: 'hosted-value' });
  });
  it('overrides inherited configuration with .env and never reads variant files', () => {
    const cwd = directory();
    writeFileSync(path.join(cwd, '.env'), 'MONGODB_URI=root-value\nDATABASE_URL=root-sql\n');
    writeFileSync(path.join(cwd, '.env.local'), 'MONGODB_URI=wrong-value\nLOCAL_ONLY=wrong\n');
    const env: Record<string, string | undefined> = { MONGODB_URI: 'inherited-value' };
    loadRootEnvironment({ cwd, env });
    expect(env).toEqual({ MONGODB_URI: 'root-value', DATABASE_URL: 'root-sql' });
  });
  it('removes Next-loaded variant values while retaining original deployment settings', () => {
    const cwd = directory();
    writeFileSync(path.join(cwd, '.env'), 'MONGODB_URI=root-value\n');
    const env: Record<string, string | undefined> = { MONGODB_URI: 'local-value', LOCAL_ONLY: 'wrong', DEPLOYMENT_KEY: 'wrong' };
    loadRootEnvironment({ cwd, env, initialEnv: { DEPLOYMENT_KEY: 'hosted-value' }, loadedEnvFiles: [
      { path: '.env.local', env: { MONGODB_URI: 'local-value', LOCAL_ONLY: 'wrong', DEPLOYMENT_KEY: 'wrong' } },
    ] });
    expect(env).toEqual({ MONGODB_URI: 'root-value', DEPLOYMENT_KEY: 'hosted-value' });
  });
  it('supports hosted configuration without a local .env and ignores other variants', () => {
    const cwd = directory();
    const env: Record<string, string | undefined> = { DATABASE_URL: 'hosted-sql', VARIANT_ONLY: 'wrong' };
    loadRootEnvironment({ cwd, env, initialEnv: { DATABASE_URL: 'hosted-sql' }, loadedEnvFiles: [
      { path: '.env.production.local', env: { VARIANT_ONLY: 'wrong' } },
    ] });
    expect(env).toEqual({ DATABASE_URL: 'hosted-sql' });
  });
});
