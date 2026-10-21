/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SoundRemixModal from '../room/components/SoundRemixModal';
import type { SharedRoomEnvironment } from '../types';

describe('SoundRemixModal component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockEnvironment: SharedRoomEnvironment = {
    backgroundId: 'cozy-fireplace',
    music: null,
    ambience: {
      presetId: 'fireplace',
      volume: 70,
      isPlaying: true,
    },
    updatedAt: Date.now(),
    updatedByUserId: 'test-user',
  };

  const mockActions = {
    setAmbiencePreset: vi.fn(),
    setAmbiencePlaying: vi.fn(),
    setAmbienceVolume: vi.fn(),
  };

  it('renders header, Now playing, Ambient layers, and Quick presets sections', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
        actions={mockActions}
      />
    );

    // Header check
    expect(screen.getByRole('heading', { name: /Sounds & Music/i })).toBeTruthy();
    expect(screen.getByText('Create your perfect study atmosphere')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Close/i })).toBeTruthy();

    // Now playing section check
    expect(screen.getByText(/Now playing/i)).toBeTruthy();
    expect(screen.getByText('Fireplace Ambience')).toBeTruthy();
    expect(screen.getByText(/by Undone · 45:12/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Now playing volume' })).toBeTruthy();

    // Ambient layers section check
    expect(screen.getByText(/Ambient layers/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add layer/i })).toBeTruthy();
    expect(screen.getAllByText('Fireplace').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Rain on windows')).toBeTruthy();
    expect(screen.getByText('Café ambiance')).toBeTruthy();
    expect(screen.getByText('White noise')).toBeTruthy();

    // Quick presets section check
    expect(screen.getByText(/Quick presets/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /See all/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset None' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Fireplace' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Rain' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Cafe' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Forest' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Ocean' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Preset Night' })).toBeTruthy();
  });

  it('changes layer volume slider and updates volume display', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
        actions={mockActions}
      />
    );

    const fireplaceSlider = screen.getByRole('slider', {
      name: 'Fireplace volume',
    }) as HTMLInputElement;

    expect(fireplaceSlider.value).toBe('60');
    expect(screen.getByText('60%')).toBeTruthy();

    // Change Fireplace volume to 85%
    fireEvent.change(fireplaceSlider, { target: { value: '85' } });

    expect(fireplaceSlider.value).toBe('85');
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('selects a quick preset and updates active preset and Now playing title', () => {
    const onSelectPreset = vi.fn();
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
        actions={mockActions}
        onSelectPreset={onSelectPreset}
      />
    );

    // Initial state: Fireplace preset is checked
    const fireplacePreset = screen.getByRole('radio', { name: 'Preset Fireplace' });
    expect(fireplacePreset.getAttribute('aria-checked')).toBe('true');

    // Click 'Rain' preset
    const rainPreset = screen.getByRole('radio', { name: 'Preset Rain' });
    fireEvent.click(rainPreset);

    // Verify Rain preset is now active
    expect(rainPreset.getAttribute('aria-checked')).toBe('true');
    expect(fireplacePreset.getAttribute('aria-checked')).toBe('false');

    // Now playing updates to 'Rain Ambience'
    expect(screen.getByText('Rain Ambience')).toBeTruthy();

    // Callbacks were invoked
    expect(mockActions.setAmbiencePreset).toHaveBeenCalledWith('rain');
    expect(onSelectPreset).toHaveBeenCalledWith('rain');
  });

  it('selects None preset and handles stopping ambience', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
        actions={mockActions}
      />
    );

    const nonePreset = screen.getByRole('radio', { name: 'Preset None' });
    fireEvent.click(nonePreset);

    expect(nonePreset.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('No Sound Playing')).toBeTruthy();
    expect(mockActions.setAmbiencePreset).toHaveBeenCalledWith(null);
  });

  it('allows removing an ambient layer', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
      />
    );

    expect(screen.getByText('White noise')).toBeTruthy();
    const removeBtn = screen.getByRole('button', { name: 'Remove White noise' });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('White noise')).toBeNull();
  });

  it('allows adding a new ambient layer via Add layer menu', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
      />
    );

    const addLayerBtn = screen.getByRole('button', { name: 'Add layer' });
    fireEvent.click(addLayerBtn);

    const oceanMenuItem = screen.getByRole('menuitem', { name: /Ocean waves/i });
    expect(oceanMenuItem).toBeTruthy();

    fireEvent.click(oceanMenuItem);

    expect(screen.getByText('Ocean waves')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Ocean waves volume' })).toBeTruthy();
  });

  it('toggles master play/pause and volume controls', () => {
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={vi.fn()}
        environment={mockEnvironment}
        actions={mockActions}
      />
    );

    const playPauseBtn = screen.getByRole('button', { name: 'Pause' });
    fireEvent.click(playPauseBtn);

    expect(mockActions.setAmbiencePlaying).toHaveBeenCalledWith(false);
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();

    const masterSlider = screen.getByRole('slider', { name: 'Now playing volume' });
    fireEvent.change(masterSlider, { target: { value: '45' } });

    expect(mockActions.setAmbienceVolume).toHaveBeenCalledWith(45);
    expect(screen.getByText('45%')).toBeTruthy();
  });

  it('closes when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <SoundRemixModal
        isOpen={true}
        onClose={onClose}
        environment={mockEnvironment}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SoundRemixModal
        isOpen={false}
        onClose={vi.fn()}
        environment={mockEnvironment}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
