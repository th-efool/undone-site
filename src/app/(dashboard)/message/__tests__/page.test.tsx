// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import MessagePage from '../page';

// Mock dynamic import of Message
vi.mock('@/src/client/screens/dashboard/message', () => ({
  Message: () => <div data-testid="message-component">Message Screen</div>,
}));

describe('MessagePage', () => {
  it('renders JSON-LD structured data and mounts the real Message component in Suspense', () => {
    const { container } = render(<MessagePage />);

    // Verify JSON-LD script
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const json = JSON.parse(script?.innerHTML ?? '{}');
    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('WebPage');
    expect(json.name).toBe('Undone > Messages');

    // Verify real message component is rendered
    expect(screen.getByTestId('message-component')).toBeTruthy();

    // Verify NO obsolete skeleton container is present
    expect(container.querySelector('[class*="messageSkeletonShell"]')).toBeNull();
    expect(container.querySelector('[class*="messageSidebarSkeleton"]')).toBeNull();
  });
});
