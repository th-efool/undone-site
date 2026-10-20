/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PanelShell } from '../room/components/PanelShell';

describe('PanelShell component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders title, children, footer, and focuses heading on mount', () => {
    const handleClose = vi.fn();

    render(
      <PanelShell
        id="test-panel"
        title="Session Tasks"
        onClose={handleClose}
        footer={<button type="button">Action</button>}
      >
        <p>Panel body content</p>
      </PanelShell>
    );

    const heading = screen.getByRole('heading', { name: 'Session Tasks' });
    expect(heading).toBeTruthy();
    // Heading receives focus on mount for accessibility
    expect(document.activeElement).toBe(heading);

    expect(screen.getByText('Panel body content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Action' })).toBeTruthy();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('id')).toBe('test-panel');
    expect(dialog.getAttribute('aria-labelledby')).toBe('test-panel-title');
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <PanelShell
        title="People"
        onClose={handleClose}
      >
        <div>Content</div>
      </PanelShell>
    );

    const closeBtn = screen.getByRole('button', { name: 'Close People' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when scrim backdrop is clicked', () => {
    const handleClose = vi.fn();

    render(
      <PanelShell
        title="Settings"
        onClose={handleClose}
      >
        <div>Content</div>
      </PanelShell>
    );

    const scrim = screen.getByRole('button', { name: 'Close panel' });
    fireEvent.click(scrim);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
