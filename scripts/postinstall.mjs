import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Vercel runs npm's prebuild and build lifecycle after installation. Leave
// workspace builds and Prisma generation to that path to avoid doing both twice.
if (process.env.VERCEL === '1') {
  console.log('Skipping local postinstall builds on Vercel; the build lifecycle handles them.');
  process.exit(0);
}

const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) {
  throw new Error('npm_execpath is unavailable; cannot run the local postinstall steps.');
}

const runNpm = (args) => execFileSync(process.execPath, [npmCli, ...args], { stdio: 'inherit' });

runNpm(['run', 'prebuild']);
runNpm(['exec', '--', 'prisma', 'generate']);
