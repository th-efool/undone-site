// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import NotesPage from '../page';

// Mock dynamic import of Notes
vi.mock('@/src/client/screens/dashboard/notes', () => ({
  Notes: () => <div data-testid="notes-component">Notes Screen</div>,
}));

describe('NotesPage', () => {
  it('renders JSON-LD structured data and mounts the real Notes component in Suspense', () => {
    const { container } = render(<NotesPage />);

    // Verify JSON-LD script
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const json = JSON.parse(script?.innerHTML ?? '{}');
    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('WebPage');
    expect(json.name).toBe('Undone > Notes');

    // Verify real notes component is rendered
    expect(screen.getByTestId('notes-component')).toBeTruthy();

    // Verify NO obsolete skeleton container is present
    expect(container.querySelector('[class*="notesSkeletonShell"]')).toBeNull();
    expect(container.querySelector('[class*="notesSidebarSkeleton"]')).toBeNull();
  });
});
