import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Root .env is the only local configuration file. Never log parsed values.
 * @param {{ cwd?: string, env?: Record<string, string | undefined>,
 * initialEnv?: Record<string, string | undefined>,
 * loadedEnvFiles?: Array<{ path: string, env?: Record<string, string | undefined> }> }} [options]
 */
export function loadRootEnvironment({ cwd = process.cwd(), env = process.env, initialEnv = env,
  loadedEnvFiles = [] } = {}) {
  const file = path.join(cwd, '.env');
  const root = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  // Next loads variants before evaluating next.config. Discard their contributions,
  // but preserve values that already came from the shell/deployment environment.
  for (const loaded of loadedEnvFiles) {
    if (loaded.path === '.env') continue;
    for (const key of Object.keys(loaded.env ?? {})) {
      if (initialEnv[key] === undefined && root[key] === undefined) delete env[key];
      else if (root[key] === undefined) env[key] = initialEnv[key];
    }
  }
  Object.assign(env, root);
}
