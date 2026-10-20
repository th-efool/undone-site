// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { Logo } from '../Logo';

describe('Logo', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders logo with lazy loading when priority is false', () => {
    render(<Logo priority={false} />);
    const img = screen.getByAltText('Undone logo');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('fetchpriority')).toBeNull();
  });

  it('renders logo with eager loading and high fetchpriority when priority is true', () => {
    render(<Logo priority={true} />);
    const img = screen.getByAltText('Undone logo');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });
});
