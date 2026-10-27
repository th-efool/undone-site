// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SidebarItem } from '../Sidebar/SidebarItem';

afterEach(cleanup);

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/notes',
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock haptics
vi.mock('@/src/client/utils/haptics', () => ({
  triggerHaptic: vi.fn(),
}));

const MockIcon = () => <svg data-testid="mock-icon" />;

describe('Wave 6.0: Shell and Navigation Unification', () => {
  const rootDir = path.resolve(__dirname, '../../../../../');

  it('renders SidebarItem with accessible link and label', () => {
    render(<SidebarItem href="/notes" label="Notes" icon={MockIcon} />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/notes');
    expect(screen.getByTestId('mock-icon')).toBeDefined();
    expect(link.className).toContain('active');
  });

  it('renders disabled SidebarItem with proper disabled class', () => {
    render(<SidebarItem href="/disabled" label="Coming Soon" icon={MockIcon} disabled={true} />);

    const link = screen.getByRole('link');
    expect(link.className).toContain('disabled');
  });

  it('verifies DashboardShell.module.css uses canonical --ud-color-background tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/components/global/DashboardShell/DashboardShell.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-background');
  });

  it('verifies SidebarItem.module.css uses canonical tokens for text, brand, and radius', () => {
    const cssPath = path.resolve(rootDir, 'src/client/components/global/Sidebar/SidebarItem.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-text-secondary');
    expect(css).toContain('var(--ud-color-brand');
    expect(css).toContain('var(--ud-color-brand-subtle');
    expect(css).toContain('var(--ud-radius-lg');
  });

  it('verifies CommandPalette.module.css uses canonical surface and radius tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/components/global/CommandPalette/CommandPalette.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-surface');
    expect(css).toContain('var(--ud-radius-xl');
    expect(css).toContain('var(--ud-color-text-primary');
  });

  it('verifies MobileNav.module.css uses canonical border and brand tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/mobile/components/navigation/MobileNav/MobileNav.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-border-subtle');
    expect(css).toContain('var(--ud-color-brand');
  });

  it('verifies Navbar.module.css uses canonical brand and text tokens', () => {
    const cssPath = path.resolve(rootDir, 'src/client/components/global/Navbar/Navbar.module.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('var(--ud-color-brand');
    expect(css).toContain('var(--ud-color-text-secondary');
  });
});
