// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { NotesSkeleton } from '../NotesSkeleton';

describe('NotesSkeleton component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the skeleton container with proper ARIA accessibility attributes', () => {
    const { container } = render(<NotesSkeleton />);
    const shell = container.querySelector('[aria-busy="true"]');
    expect(shell).toBeTruthy();
    expect(shell?.getAttribute('aria-label')).toBe('Loading notes workspace');
  });

  it('renders the 3-column notes interface layout', () => {
    render(<NotesSkeleton />);
    expect(screen.getByTestId('notes-sidebar-skeleton')).toBeTruthy();
    expect(screen.getByTestId('notes-list-skeleton')).toBeTruthy();
    expect(screen.getByTestId('notes-canvas-skeleton')).toBeTruthy();
  });

  it('contains skeleton lines and blocks inside each column', () => {
    const { container } = render(<NotesSkeleton />);
    const lines = container.querySelectorAll('[class*="skeletonLine"]');
    const blocks = container.querySelectorAll('[class*="skeletonBlock"]');

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
  });
});
