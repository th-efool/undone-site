/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RoomSocial from '../room/components/RoomSocial';
import type { RoomParticipantView, Viewer } from '../types';

describe('RoomSocial component', () => {
  afterEach(() => {
    cleanup();
  });
  const mockViewer: Viewer = {
    userId: 'viewer-1',
    displayName: 'Test User',
    avatarUrl: null,
    role: 'admin',
  };

  const mockParticipants: RoomParticipantView[] = [
    {
      userId: 'viewer-1',
      displayName: 'Test User',
      avatarUrl: null,
      joinedAt: Date.now(),
      publicGoal: null,
      isCurrentUser: true,
      isAdmin: true,
    },
    {
      userId: 'aarav',
      displayName: 'Aarav',
      avatarUrl: null,
      joinedAt: Date.now() - 60000,
      publicGoal: 'Reading · Chapter 4',
      isCurrentUser: false,
      isAdmin: false,
    },
  ];

  it('renders people list with host indicator and mute indicators', () => {
    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
      />
    );

    expect(screen.getByText('People · 2')).toBeTruthy();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.getByText(/Host/)).toBeTruthy();
    expect(screen.getAllByText('Aarav').length).toBeGreaterThan(0);
    expect(screen.getByTitle('Microphone muted')).toBeTruthy();
  });

  it('renders default chat messages and allows sending a new message', () => {
    render(
      <RoomSocial
        participants={mockParticipants}
        viewer={mockViewer}
        onOpenPeople={vi.fn()}
        onNotify={vi.fn()}
        showPeople={true}
      />
    );

    expect(screen.getAllByText(/Chat/).length).toBeGreaterThan(0);
    expect(
      screen.getByText('just finished the 1st section this was actually fun 🚀')
    ).toBeTruthy();

    const input = screen.getByLabelText('Write a message');
    fireEvent.change(input, { target: { value: 'Taking a 5 minute break!' } });

    const form = input.closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText('Taking a 5 minute break!')).toBeTruthy();
  });
});
