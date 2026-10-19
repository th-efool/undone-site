// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MessageLoading from '../loading';
import { MessageMobile } from '@/src/client/mobile/screens/Message/MessageMobile';

// Mock next-auth safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/src/client/components/global/CommandPalette/CommandTrigger', () => ({
  useCommandContext: () => ({
    openCommand: vi.fn(),
    closeCommand: vi.fn(),
    toggleCommand: vi.fn(),
    isOpen: false,
  }),
}));

describe('Message Route Loading Boundary (Issue 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real Message page composition during loading instead of an obsolete skeleton layout', () => {
    const { container } = render(<MessageLoading />);

    // Must render the actual message landing/desktop shell
    expect(container.querySelector('[class*="message"]')).toBeTruthy();

    // Must NOT contain any obsolete MessageSkeleton elements
    expect(container.querySelector('[class*="messageSkeletonShell"]')).toBeNull();
    expect(container.querySelector('[class*="messageSidebarSkeleton"]')).toBeNull();
    expect(container.querySelector('[class*="messageMainSkeleton"]')).toBeNull();

    // Must NOT contain any shimmer animations
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders real desktop message shell without skeleton or shimmer', () => {
    const { container } = render(<MessageLoading />);

    // Desktop sections (Recent Messages, Friends Online) should be present
    expect(screen.getByText(/recent messages/i)).toBeDefined();
    expect(screen.getByText(/friends online/i)).toBeDefined();

    // Zero skeleton containers or shimmer elements
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders real mobile message shell without skeleton or shimmer', () => {
    const mockModel = {
      conversations: [
        {
          id: 'conv-1',
          name: 'General Cohort',
          preview: 'Hello everyone!',
          kind: 'community',
        },
      ],
      actions: {
        selectConversation: vi.fn(),
      },
    };

    const { container } = render(<MessageMobile model={mockModel as unknown as Parameters<typeof MessageMobile>[0]['model']} />);

    // Mobile header and chat list should be present
    expect(screen.getByRole('heading', { name: /messages/i })).toBeDefined();
    expect(screen.getByText('General Cohort')).toBeDefined();
    expect(screen.getByText('Hello everyone!')).toBeDefined();

    // Zero skeleton containers or shimmer elements
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });
});
