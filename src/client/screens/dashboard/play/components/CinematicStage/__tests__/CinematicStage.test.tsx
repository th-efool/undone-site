// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CinematicStage } from '../CinematicStage';

describe('CinematicStage foundation behaviors', () => {
  it('renders feed progress dots reflecting true itemStatuses rather than index position', () => {
    const onIndexChange = vi.fn();

    render(
      <CinematicStage
        currentIndex={1}
        totalItems={3}
        isPlaying={false}
        itemStatuses={['completed', 'not-started', 'not-started']}
        onIndexChange={onIndexChange}
        onSeek={vi.fn()}
        onSpeedChange={vi.fn()}
        onTogglePlay={vi.fn()}
        onToggleFullscreen={vi.fn()}
        renderScene={(idx) => <div data-testid={`scene-${idx}`}>Scene {idx}</div>}
      />
    );

    const buttons = screen.getAllByRole('button', { name: /Jump to video/i });
    expect(buttons).toHaveLength(3);

    // Dot 0 is completed
    expect(buttons[0].className).toContain('dotCompleted');
    expect(buttons[0].className).not.toContain('dotActive');

    // Dot 1 is active (visualIndex = 1)
    expect(buttons[1].className).toContain('dotActive');
    expect(buttons[1].className).not.toContain('dotCompleted');

    // Dot 2 is not completed and not active
    expect(buttons[2].className).not.toContain('dotCompleted');
    expect(buttons[2].className).not.toContain('dotActive');

    // Clicking Dot 2 triggers onIndexChange with exact target index 2
    fireEvent.click(buttons[2]);
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('restores previous playback speed after long-press acceleration ends', () => {
    vi.useFakeTimers();
    const onSpeedChange = vi.fn();

    const { container } = render(
      <CinematicStage
        currentIndex={0}
        totalItems={2}
        isPlaying={true}
        playbackSpeed={1.5}
        itemStatuses={['not-started', 'not-started']}
        onIndexChange={vi.fn()}
        onSeek={vi.fn()}
        onSpeedChange={onSpeedChange}
        onTogglePlay={vi.fn()}
        onToggleFullscreen={vi.fn()}
        renderScene={(idx) => <div>Scene {idx}</div>}
      />
    );

    const stageEl = container.firstChild as HTMLElement;

    // Simulate pointer down to trigger 450ms long press
    fireEvent.pointerDown(stageEl, { clientX: 200, clientY: 200, pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSpeedChange).toHaveBeenCalledWith(2.0);

    // Release pointer to end long press
    fireEvent.pointerUp(stageEl);

    // Speed should be restored to initial 1.5, not reset to default 1.0
    expect(onSpeedChange).toHaveBeenCalledWith(1.5);
    vi.useRealTimers();
  });
});
