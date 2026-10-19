// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
}));

vi.mock('@/src/client/screens/dashboard/explore', () => ({
  Explore: () => <div data-testid="explore-content">Explore Main Content</div>,
}));

import ExplorePage, { metadata } from '../page';

describe('ExplorePage (src/app/(dashboard)/explore/page.tsx)', () => {
  afterEach(() => {
    cleanup();
  });

  it('exports correct metadata with title, description, openGraph, and twitter', () => {
    expect(metadata.title).toBe('Explore');
    expect(metadata.description).toContain('Discover new cohorts');
    expect(metadata.openGraph).toMatchObject({
      title: 'Undone > Explore',
      url: 'https://undone.in/explore',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Undone > Explore',
    });
  });

  it('renders accessibility heading and schema.org JSON-LD tag', () => {
    const { container } = render(<ExplorePage />);

    const heading = screen.getByRole('heading', { level: 1, name: /explore undone/i });
    expect(heading).toBeTruthy();
    expect(heading.className).toContain('sr-only');

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const jsonLd = JSON.parse(script?.innerHTML ?? '{}');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('WebPage');
    expect(jsonLd.name).toBe('Undone > Explore');
  });

  it('renders the Explore content wrapped in Suspense with fallback', async () => {
    render(<ExplorePage />);

    const content = await screen.findByTestId('explore-content');
    expect(content).toBeTruthy();
  });
});
