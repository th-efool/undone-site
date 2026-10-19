/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChannelSelector,
  CHANNELS,
  DEFAULT_CHANNEL_ICON_MAP,
} from '../../ChannelSelector';
import { Coffee, Zap, Compass, Hammer, Headphones, Search } from 'lucide-react';

beforeEach(() => {
  vi.useFakeTimers();
  if (typeof window !== 'undefined' && !window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? 'mouse';
      }
    }
    Object.assign(window, { PointerEvent: MockPointerEvent });
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ChannelSelector radial switcher component', () => {
  it('renders a compact circular trigger button without channel name text or dropdown chevron', () => {
    render(
      <ChannelSelector
        activeChannel="deep_dive"
        onChannelSelect={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('data-state')).toBe('idle');
    // Must not display channel name text or permanently visible constellation
    expect(trigger.textContent).toBe('');
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
  });

  it('preserves all seven existing channel definitions and fixed icon mapping with Quick explicitly unassigned', () => {
    expect(CHANNELS).toEqual([
      { id: 'default', label: 'Default', desc: 'Balanced sequential progression' },
      { id: 'spark', label: 'Spark', desc: 'High-energy insights & hooks' },
      { id: 'explore', label: 'Explore', desc: 'Broad cross-topic discovery' },
      { id: 'build', label: 'Build', desc: 'Hands-on code & implementation' },
      { id: 'listen', label: 'Listen', desc: 'Audio-friendly conceptual talks' },
      { id: 'deep_dive', label: 'Deep Dive', desc: 'Rigorous theory & architecture' },
      { id: 'quick', label: 'Quick', desc: 'Fast bite-sized micro-chunks' },
    ]);

    expect(DEFAULT_CHANNEL_ICON_MAP.default).toBe(Coffee);
    expect(DEFAULT_CHANNEL_ICON_MAP.spark).toBe(Zap);
    expect(DEFAULT_CHANNEL_ICON_MAP.explore).toBe(Compass);
    expect(DEFAULT_CHANNEL_ICON_MAP.build).toBe(Hammer);
    expect(DEFAULT_CHANNEL_ICON_MAP.listen).toBe(Headphones);
    expect(DEFAULT_CHANNEL_ICON_MAP.deep_dive).toBe(Search);
    expect(DEFAULT_CHANNEL_ICON_MAP.quick).toBeNull();
  });

  it('opens on a quick click without switching, then switches when a channel is clicked', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
        holdThresholdMs={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });

    fireEvent.pointerDown(trigger, { button: 0, clientX: 84, clientY: 84 });
    expect(trigger.getAttribute('data-state')).toBe('pressed');

    act(() => {
      vi.advanceTimersByTime(80);
    });
    fireEvent.pointerUp(trigger, { clientX: 84, clientY: 84 });

    // Menu stays open after a tap, and nothing is switched yet
    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();
    expect(onChannelSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Build' }));
    expect(onChannelSelect).toHaveBeenCalledTimes(1);
    expect(onChannelSelect).toHaveBeenCalledWith('build');
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
  });

  it('opens the radial constellation when held past the hold threshold and renders all 7 channels', () => {
    render(
      <ChannelSelector
        activeChannel="deep_dive"
        onChannelSelect={vi.fn()}
        holdThresholdMs={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 64,
      top: 64,
      width: 40,
      height: 40,
      right: 104,
      bottom: 104,
      x: 64,
      y: 64,
      toJSON: () => {},
    });

    fireEvent.pointerDown(trigger, { button: 0, clientX: 84, clientY: 84 });

    act(() => {
      vi.advanceTimersByTime(210);
    });

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: /channel switcher/i });
    expect(menu).toBeDefined();

    // Verify all 7 channel options are rendered with accessible names
    for (const ch of CHANNELS) {
      const option = screen.getByRole('menuitemradio', { name: ch.label });
      expect(option).toBeDefined();
      expect(option.getAttribute('data-channel-id')).toBe(ch.id);
      if (ch.id === 'deep_dive') {
        expect(option.getAttribute('aria-checked')).toBe('true');
      } else {
        expect(option.getAttribute('aria-checked')).toBe('false');
      }
    }
  });

  it('highlights targeted channels on pointer drag without switching prematurely, and switches only on release', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
        holdThresholdMs={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 40,
      height: 40,
      right: 140,
      bottom: 140,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // Center is at (120, 120)
    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });

    const menu = screen.getByRole('menu', { name: /channel switcher/i });
    expect(menu.getAttribute('data-state')).toBe('open');

    // Drag to Spark (first outer node at 12 o'clock -> (120, 48))
    fireEvent.pointerMove(trigger, { clientX: 120, clientY: 48 });
    const sparkOpt = screen.getByRole('menuitemradio', { name: 'Spark' });
    expect(sparkOpt.getAttribute('data-targeted')).toBe('true');
    expect(onChannelSelect).not.toHaveBeenCalled();

    // Drag to Explore (-30° -> (182, 84))
    fireEvent.pointerMove(trigger, { clientX: 182, clientY: 84 });
    const exploreOpt = screen.getByRole('menuitemradio', { name: 'Explore' });
    expect(exploreOpt.getAttribute('data-targeted')).toBe('true');
    expect(sparkOpt.getAttribute('data-targeted')).toBe('false');
    expect(onChannelSelect).not.toHaveBeenCalled();

    // Release over Explore -> commits selection and closes menu
    fireEvent.pointerUp(trigger, { clientX: 182, clientY: 84 });
    expect(onChannelSelect).toHaveBeenCalledTimes(1);
    expect(onChannelSelect).toHaveBeenCalledWith('explore');
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
  });

  it('puts Default at the center: releasing in place does nothing, dragging back to the center selects Default', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="spark"
        onChannelSelect={onChannelSelect}
        holdThresholdMs={200}
      />
    );
    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 100, width: 40, height: 40, right: 140, bottom: 140, x: 100, y: 100,
      toJSON: () => {},
    });

    // Hold and release without moving -> no switch
    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });
    fireEvent.pointerUp(trigger, { clientX: 120, clientY: 120 });
    expect(onChannelSelect).not.toHaveBeenCalled();

    // Hold, drag out to a node and back onto the center -> Default
    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });
    fireEvent.pointerMove(trigger, { clientX: 182, clientY: 84 });
    fireEvent.pointerMove(trigger, { clientX: 128, clientY: 128 });
    expect(screen.getByRole('menuitemradio', { name: 'Default' }).getAttribute('data-targeted')).toBe('true');
    fireEvent.pointerUp(trigger, { clientX: 128, clientY: 128 });
    expect(onChannelSelect).toHaveBeenCalledWith('default');
  });

  it('allows selecting Quick channel via hold-drag-release while its icon remains configurable', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
        holdThresholdMs={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 40,
      height: 40,
      right: 140,
      bottom: 140,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });

    // Quick is the 6th outer node (210° -> dx ≈ -62, dy ≈ -36 -> (58, 84))
    fireEvent.pointerMove(trigger, { clientX: 58, clientY: 84 });
    const quickOpt = screen.getByRole('menuitemradio', { name: 'Quick' });
    expect(quickOpt.getAttribute('data-targeted')).toBe('true');

    fireEvent.pointerUp(trigger, { clientX: 58, clientY: 84 });
    expect(onChannelSelect).toHaveBeenCalledTimes(1);
    expect(onChannelSelect).toHaveBeenCalledWith('quick');
  });

  it('cancels without switching when released over the central trigger or far outside the menu', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="explore"
        onChannelSelect={onChannelSelect}
        holdThresholdMs={200}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 40,
      height: 40,
      right: 140,
      bottom: 140,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // 1. Release over central trigger (120, 120)
    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();

    fireEvent.pointerUp(trigger, { clientX: 120, clientY: 120 });
    expect(onChannelSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();

    // 2. Drag to a channel then drag far outside (e.g. 500, 500) and release
    fireEvent.pointerDown(trigger, { button: 0, clientX: 120, clientY: 120 });
    act(() => {
      vi.advanceTimersByTime(210);
    });
    fireEvent.pointerMove(trigger, { clientX: 120, clientY: 48 }); // target Spark (top of ring)
    expect(screen.getByRole('menuitemradio', { name: 'Spark' }).getAttribute('data-targeted')).toBe('true');

    fireEvent.pointerMove(trigger, { clientX: 500, clientY: 500 }); // move far outside
    expect(screen.getByRole('menuitemradio', { name: 'Spark' }).getAttribute('data-targeted')).toBe('false');

    fireEvent.pointerUp(trigger, { clientX: 500, clientY: 500 });
    expect(onChannelSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
  });

  it('closes menu and restores focus to trigger on Escape key press or pointercancel', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    fireEvent.pointerDown(trigger, { button: 0, clientX: 84, clientY: 84 });
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onChannelSelect).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation (Enter to open, Arrow keys to cycle, Enter to select)', () => {
    const onChannelSelect = vi.fn();
    render(
      <ChannelSelector
        activeChannel="default"
        onChannelSelect={onChannelSelect}
      />
    );

    const trigger = screen.getByRole('button', { name: /open channel switcher/i });
    trigger.focus();

    // Open with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();

    // ArrowRight moves from 'default' (index 0) -> 'spark' (index 1)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const sparkOpt = screen.getByRole('menuitemradio', { name: 'Spark' });
    expect(sparkOpt.getAttribute('data-targeted')).toBe('true');

    // Enter on Spark option commits selection
    fireEvent.keyDown(sparkOpt, { key: 'Enter' });
    expect(onChannelSelect).toHaveBeenCalledWith('spark');
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
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

    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();

    rerender(
      <ChannelSelector
        activeChannel="explore"
        onChannelSelect={vi.fn()}
        isOpen={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();
  });
});
