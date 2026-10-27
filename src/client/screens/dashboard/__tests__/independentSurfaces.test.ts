import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Wave 6.1: Independent Application Surfaces Token Unification', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');

  it('verifies Explore.module.css uses canonical surface, border, and radius tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/screens/dashboard/explore/Explore.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-radius-lg');
    expect(css).toContain('var(--ud-color-surface');
    expect(css).toContain('var(--ud-color-border-subtle');
  });

  it('verifies Home.module.css uses canonical background token', () => {
    const cssPath = path.resolve(rootDir, 'src/client/screens/dashboard/home/Home.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-background');
  });

  it('verifies Message.module.css uses canonical radius and pill tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/screens/dashboard/message/Message.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-radius-2xl');
    expect(css).toContain('var(--ud-radius-lg');
    expect(css).toContain('var(--ud-radius-pill');
  });
});
