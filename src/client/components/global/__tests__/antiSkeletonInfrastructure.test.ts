import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('Shared Skeleton Infrastructure Decommissioning (Issue 8)', () => {
  it('verifies that src/client/components/global/Skeleton directory and files have been removed', () => {
    const skeletonDir = path.resolve(process.cwd(), 'src/client/components/global/Skeleton');
    const skeletonExists = fs.existsSync(skeletonDir);
    expect(skeletonExists).toBe(false);
  });

  it('verifies zero occurrences of @keyframes shimmer or animation: shimmer in any CSS file', () => {
    const srcDir = path.resolve(process.cwd(), 'src');

    function scanCssFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanCssFiles(fullPath));
        } else if (file.endsWith('.css')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const cssFiles = scanCssFiles(srcDir);
    expect(cssFiles.length).toBeGreaterThan(0);

    for (const cssFile of cssFiles) {
      const content = fs.readFileSync(cssFile, 'utf8');
      expect(content).not.toMatch(/@keyframes\s+shimmer\b/);
      expect(content).not.toMatch(/animation:\s*shimmer\b/);
      expect(content).not.toMatch(/@keyframes\s+loadingShimmer\b/);
    }
  });

  it('verifies route loading boundaries do not render obsolete skeleton components', () => {
    const dashboardDir = path.resolve(process.cwd(), 'src/app/(dashboard)');

    function scanLoadingFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanLoadingFiles(fullPath));
        } else if (file === 'loading.tsx') {
          results.push(fullPath);
        }
      }
      return results;
    }

    const loadingFiles = scanLoadingFiles(dashboardDir);
    expect(loadingFiles.length).toBeGreaterThanOrEqual(4);

    for (const loadingFile of loadingFiles) {
      const content = fs.readFileSync(loadingFile, 'utf8');
      expect(content).not.toContain('Skeleton');
      expect(content).not.toContain('PageSkeleton');
      expect(content).not.toContain('HomeSkeleton');
      expect(content).not.toContain('NotesSkeleton');
      expect(content).not.toContain('MessageSkeleton');
      expect(content).not.toContain('ExploreSkeleton');
    }
  });
});
