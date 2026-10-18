/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ChannelSelector } from '../../ChannelSelector';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChannelSelector component', () => {
  it('renders trigger button with active channel label and a11y attributes', () => {
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /select channel/i });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Default');
  });

  it('opens popover when trigger is clicked, lists channels, and selects a channel', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /select channel/i });
    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: /channel and search preferences/i })).toBeDefined();

    const sparkBtn = screen.getByRole('button', { name: /spark/i });
    expect(sparkBtn).toBeDefined();
    fireEvent.click(sparkBtn);

    expect(onChannelSelect).toHaveBeenCalledWith('spark');
    expect(screen.queryByRole('region', { name: /channel and search preferences/i })).toBeNull();
  });

  it('submits RAG topic filter when form is submitted', () => {
    const onSearchQueryChange = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={vi.fn()}
        onSearchQueryChange={onSearchQueryChange}
      />
    );

    const trigger = screen.getByRole('button', { name: /select channel/i });
    fireEvent.click(trigger);

    const searchInput = screen.getByLabelText(/rag topic filter/i);
    fireEvent.change(searchInput, { target: { value: 'rust concurrency' } });
    fireEvent.submit(searchInput.closest('form')!);

    expect(onSearchQueryChange).toHaveBeenCalledWith('rust concurrency');
  });

  it('closes popover and restores focus to trigger on Escape key press', () => {
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /select channel/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('region', { name: /channel and search preferences/i })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: /channel and search preferences/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports controlled isOpen and onOpenChange props', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ChannelSelector
        activeChannel="explore"
        onChannelSelect={vi.fn()}
        isOpen={false}
        onOpenChange={onOpenChange}
      />
    );

    const trigger = screen.getByRole('button', { name: /select channel/i });
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <ChannelSelector
        activeChannel="explore"
        onChannelSelect={vi.fn()}
        isOpen={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByRole('region', { name: /channel and search preferences/i })).toBeDefined();
  });
});
