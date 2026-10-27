import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Wave 6.2: Specialized Surfaces Token Unification', () => {
  const rootDir = path.resolve(__dirname, '../../../../../../');

  it('verifies CreateCohort.module.css uses canonical text and border tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/screens/dashboard/createCohort/CreateCohort.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-text-primary');
    expect(css).toContain('var(--ud-color-text-muted');
    expect(css).toContain('var(--ud-color-border-subtle');
  });
});
