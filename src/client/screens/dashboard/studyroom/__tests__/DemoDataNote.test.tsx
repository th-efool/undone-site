/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DemoDataNote } from '../room/components/DemoDataNote';

describe('DemoDataNote component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default prototype text', () => {
    render(<DemoDataNote />);
    expect(
      screen.getByText('Prototype · sample participants and roles.')
    ).toBeTruthy();
  });

  it('renders custom children when provided', () => {
    render(<DemoDataNote>Custom demo disclaimer</DemoDataNote>);
    expect(screen.getByText('Custom demo disclaimer')).toBeTruthy();
  });
});
