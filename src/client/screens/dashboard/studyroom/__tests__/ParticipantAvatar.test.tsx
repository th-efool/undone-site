/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ParticipantAvatar } from '../components/ParticipantAvatar';

describe('ParticipantAvatar component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders image when src is provided', () => {
    const { container } = render(
      <ParticipantAvatar name="Alex Developer" src="/alex.jpg" size={32} />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/alex.jpg');
    expect(img?.getAttribute('width')).toBe('32');
    expect(img?.getAttribute('height')).toBe('32');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back to initials when image triggers error', () => {
    const { container } = render(
      <ParticipantAvatar name="Alex Developer" src="/broken.jpg" />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    // 'Alex Developer' -> initials 'AD'
    expect(screen.getByText('AD')).toBeTruthy();
  });

  it('renders initials directly when src is null or omitted', () => {
    const { container, rerender } = render(<ParticipantAvatar name="Mira" />);
    expect(screen.getByText('MI')).toBeTruthy();

    rerender(<ParticipantAvatar name="Sam Smith Jones" />);
    // 'Sam' + 'Jones' -> 'SJ'
    expect(screen.getByText('SJ')).toBeTruthy();

    rerender(<ParticipantAvatar name="   " />);
    // Empty name defaults to 'G' (Guest)
    expect(screen.getByText('G')).toBeTruthy();

    const initialsDiv = container.querySelector('div[aria-hidden="true"]');
    expect(initialsDiv).toBeTruthy();
  });
});
