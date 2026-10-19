import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, normalize } from 'node:path';
import { createHash } from 'node:crypto';

export const REFERENCE_DIR = resolve('plans/before-after/reference');
export const BEFORE_AFTER_DIR = resolve('plans/before-after');

export function computeReferenceHashes() {
  const hashes = new Map();
  if (!existsSync(REFERENCE_DIR)) return hashes;
  const files = readdirSync(REFERENCE_DIR);
  for (const file of files) {
    if (file === 'reference-manifest.json') continue;
    const fullPath = resolve(REFERENCE_DIR, file);
    const content = readFileSync(fullPath);
    const hash = createHash('sha256').update(content).digest('hex');
    hashes.set(file, hash);
  }
  return hashes;
}

export function assertReferenceIntegrity(beforeHashes) {
  const currentHashes = computeReferenceHashes();
  if (currentHashes.size !== beforeHashes.size) {
    throw new Error(
      `CANONICAL_REFERENCE_MUTATED: Reference file count mismatch (was ${beforeHashes.size}, now ${currentHashes.size})`
    );
  }
  for (const [file, expectedHash] of beforeHashes.entries()) {
    const actualHash = currentHashes.get(file);
    if (!actualHash) {
      throw new Error(`CANONICAL_REFERENCE_MUTATED: Reference file ${file} was deleted`);
    }
    if (actualHash !== expectedHash) {
      throw new Error(
        `CANONICAL_REFERENCE_MUTATED: Reference file ${file} was mutated! Expected ${expectedHash}, got ${actualHash}`
      );
    }
  }
}

export function validateCaptureOutputPath(targetPath, commit) {
  const normalizedTarget = normalize(resolve(targetPath));
  const normalizedRefDir = normalize(REFERENCE_DIR);
  const normalizedBaseDir = normalize(BEFORE_AFTER_DIR);
  const allowedCapturesDir = normalize(resolve(BEFORE_AFTER_DIR, 'captures', commit));

  // 1. Guard against writing into reference directory
  if (normalizedTarget.startsWith(normalizedRefDir)) {
    throw new Error(
      `CANNOT_OVERWRITE_CANONICAL_REFERENCE: Output path ${targetPath} resolves within immutable reference directory`
    );
  }

  // 2. Guard against writing directly into before-after root (e.g. after-*.png, mobile-*.png)
  const relFromBase = relative(normalizedBaseDir, normalizedTarget);
  if (!relFromBase.startsWith('..')) {
    // It's within plans/before-after/
    const relFromCaptures = relative(allowedCapturesDir, normalizedTarget);
    if (relFromCaptures.startsWith('..')) {
      throw new Error(
        `CANNOT_OVERWRITE_CANONICAL_REFERENCE: Captures must be scoped exclusively to captures/${commit}/, received ${targetPath}`
      );
    }
  }

  return normalizedTarget;
}
