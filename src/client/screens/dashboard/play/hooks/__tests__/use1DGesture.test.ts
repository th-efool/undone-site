// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { use1DGesture } from '../use1DGesture';

describe('use1DGesture keyboard interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers onNext on ArrowRight when focused on non-interactive body', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    renderHook(() => use1DGesture({ onNext, onPrev }));

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    window.dispatchEvent(event);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when modifier keys (meta, ctrl, alt) are held', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onTogglePlay = vi.fn();
    renderHook(() => use1DGesture({ onNext, onPrev, onTogglePlay }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', metaKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', altKey: true, bubbles: true }));

    expect(onNext).not.toHaveBeenCalled();
    expect(onTogglePlay).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when focused on inputs or textareas', () => {
    const onTogglePlay = vi.fn();
    renderHook(() => use1DGesture({ onNext: vi.fn(), onPrev: vi.fn(), onTogglePlay }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });
    window.dispatchEvent(event);

    expect(onTogglePlay).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does not hijack spacebar or enter when focused on a button', () => {
    const onTogglePlay = vi.fn();
    renderHook(() => use1DGesture({ onNext: vi.fn(), onPrev: vi.fn(), onTogglePlay }));

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(spaceEvent, 'target', { value: button, writable: false });
    window.dispatchEvent(spaceEvent);

    expect(onTogglePlay).not.toHaveBeenCalled();
    document.body.removeChild(button);
  });

  it('does not hijack spacebar or enter when focused on an anchor link', () => {
    const onTogglePlay = vi.fn();
    renderHook(() => use1DGesture({ onNext: vi.fn(), onPrev: vi.fn(), onTogglePlay }));

    const link = document.createElement('a');
    link.href = '#';
    document.body.appendChild(link);
    link.focus();

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(spaceEvent, 'target', { value: link, writable: false });
    window.dispatchEvent(spaceEvent);

    expect(onTogglePlay).not.toHaveBeenCalled();
    document.body.removeChild(link);
  });

  it('does not hijack arrow keys when focused on a slider element', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    renderHook(() => use1DGesture({ onNext, onPrev }));

    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    document.body.appendChild(slider);

    const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    Object.defineProperty(arrowEvent, 'target', { value: slider, writable: false });
    window.dispatchEvent(arrowEvent);

    expect(onNext).not.toHaveBeenCalled();
    document.body.removeChild(slider);
  });

  it('ignores shortcuts when inside a dialog or menu', () => {
    const onNext = vi.fn();
    renderHook(() => use1DGesture({ onNext, onPrev: vi.fn() }));

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const inner = document.createElement('div');
    dialog.appendChild(inner);
    document.body.appendChild(dialog);

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    Object.defineProperty(event, 'target', { value: inner, writable: false });
    window.dispatchEvent(event);

    expect(onNext).not.toHaveBeenCalled();
    document.body.removeChild(dialog);
  });

  it('triggers onToggleMute on m key and onToggleShortcutsHelp on ? key', () => {
    const onToggleMute = vi.fn();
    const onToggleShortcutsHelp = vi.fn();
    renderHook(() =>
      use1DGesture({
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onToggleMute,
        onToggleShortcutsHelp,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(onToggleShortcutsHelp).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleChannelSelector on c and C keys', () => {
    const onToggleChannelSelector = vi.fn();
    renderHook(() =>
      use1DGesture({
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onToggleChannelSelector,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(onToggleChannelSelector).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', bubbles: true }));
    expect(onToggleChannelSelector).toHaveBeenCalledTimes(2);
  });

  it('completes horizontal drag even when pointerup occurs over an interactive UI element', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => use1DGesture({ onNext, onPrev }));

    const stageEl = document.createElement('div');
    Object.defineProperty(stageEl, 'clientWidth', { value: 1000 });
    const dockButton = document.createElement('button');
    stageEl.appendChild(dockButton);

    // Start drag on stage, move left 120px, release over dockButton in the same tick
    result.current.gestureProps.onPointerDown({
      pointerType: 'mouse',
      button: 0,
      pointerId: 1,
      clientX: 500,
      clientY: 300,
      target: stageEl,
      currentTarget: stageEl,
    } as any);

    result.current.gestureProps.onPointerMove({
      clientX: 380,
      clientY: 302,
      target: stageEl,
      currentTarget: stageEl,
    } as any);

    result.current.gestureProps.onPointerUp({
      pointerId: 1,
      clientX: 380,
      clientY: 302,
      target: dockButton,
      currentTarget: stageEl,
    } as any);

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('does not trigger layout recalculations (getBoundingClientRect or clientWidth) during pointer move', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { result } = renderHook(() => use1DGesture({ onNext, onPrev }));

    const stageEl = document.createElement('div');
    const clientWidthSpy = vi.fn().mockReturnValue(800);
    Object.defineProperty(stageEl, 'clientWidth', { get: clientWidthSpy, configurable: true });
    const getBoundingClientRectSpy = vi.spyOn(stageEl, 'getBoundingClientRect');

    result.current.gestureProps.onPointerDown({
      pointerType: 'touch',
      pointerId: 1,
      clientX: 200,
      clientY: 200,
      target: stageEl,
      currentTarget: stageEl,
    } as any);

    // Initial pointer down reads clientWidth once to cache it
    expect(clientWidthSpy).toHaveBeenCalledTimes(1);
    expect(getBoundingClientRectSpy).not.toHaveBeenCalled();

    // Reset spy call count before move events
    clientWidthSpy.mockClear();

    // Simulate rapid pointer move sequence (touch drag)
    for (let x = 205; x <= 260; x += 5) {
      result.current.gestureProps.onPointerMove({
        clientX: x,
        clientY: 200,
        target: stageEl,
        currentTarget: stageEl,
      } as any);
    }

    // Must be strictly ZERO during all pointer moves to avoid forced synchronous layouts / INP degradation
    expect(clientWidthSpy).not.toHaveBeenCalled();
    expect(getBoundingClientRectSpy).not.toHaveBeenCalled();

    // Release drag
    result.current.gestureProps.onPointerUp({
      pointerId: 1,
      clientX: 350,
      clientY: 200,
      target: stageEl,
      currentTarget: stageEl,
    } as any);

    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
