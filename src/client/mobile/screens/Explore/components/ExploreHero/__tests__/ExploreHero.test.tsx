// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { ExploreHero } from '../ExploreHero';

describe('ExploreHero', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the explore banner image with priority and fetchPriority', () => {
    render(<ExploreHero />);
    const banner = screen.getByAltText('Explore Banner');
    expect(banner).toBeTruthy();
    expect(banner.getAttribute('fetchpriority')).toBe('high');
  });

  it('renders the headline text', () => {
    render(<ExploreHero />);
    expect(screen.getByText('SINK DOWN')).toBeTruthy();
    expect(screen.getByText('THE RABBIT HOLE.')).toBeTruthy();
  });
});
