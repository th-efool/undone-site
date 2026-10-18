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
    renderHook(() => use1DGesture({ onToggleMute, onToggleShortcutsHelp }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(onToggleShortcutsHelp).toHaveBeenCalledTimes(1);
  });
});
