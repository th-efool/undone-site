import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const refDir = resolve('plans/before-after/reference');
mkdirSync(refDir, { recursive: true });

const numbers = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const files = [];

for (const n of numbers) {
  files.push(`after-${n}.png`);
  files.push(`after-${n}-full.png`);
  files.push(`mobile-${n}.png`);
  files.push(`before-${n}.png`);
  files.push(`before-${n}-full.png`);
}

const manifest = {
  baselineCommit: '0fde0f4a',
  extractedAt: new Date().toISOString(),
  files: {},
};

for (const f of files) {
  try {
    const buf = execSync(`git show 0fde0f4a:plans/before-after/${f}`, { maxBuffer: 50 * 1024 * 1024 });
    const refPath = resolve(refDir, f);
    writeFileSync(refPath, buf);
    const hash = createHash('sha256').update(buf).digest('hex');
    manifest.files[f] = {
      byteLength: buf.length,
      sha256: hash,
    };
    // Also restore in plans/before-after/
    const livePath = resolve('plans/before-after', f);
    writeFileSync(livePath, buf);
    console.log(`Restored ${f}: ${buf.length} bytes, sha256 ${hash.slice(0, 12)}...`);
  } catch (e) {
    console.error(`Failed ${f}: ${e.message}`);
  }
}

writeFileSync(resolve(refDir, 'reference-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Saved reference-manifest.json with', Object.keys(manifest.files).length, 'files');
