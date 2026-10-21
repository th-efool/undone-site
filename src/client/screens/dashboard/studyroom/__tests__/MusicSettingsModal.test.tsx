/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import MusicSettingsModal from '../room/components/MusicSettingsModal';

describe('MusicSettingsModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders header, "Add a link", "Upload audio", and "Current queue"', () => {
    render(<MusicSettingsModal isOpen={true} onClose={vi.fn()} />);

    // Header
    expect(screen.getByRole('heading', { name: 'Your music' })).toBeTruthy();
    expect(
      screen.getByText('Add your own music to the room ambience')
    ).toBeTruthy();

    // Section 1: Add a link
    expect(screen.getByRole('heading', { name: 'Add a link' })).toBeTruthy();
    expect(screen.getByText('Songs, albums, playlists, or mixes')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Paste a YouTube, Spotify, or playlist link')
    ).toBeTruthy();
    expect(screen.getByText('Supported sources')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
    expect(screen.getByText('Spotify')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to room' })).toBeTruthy();

    // Divider
    expect(screen.getByText('or')).toBeTruthy();

    // Section 2: Upload audio
    expect(screen.getByRole('heading', { name: 'Upload audio' })).toBeTruthy();
    expect(screen.getByText('Add your own audio files')).toBeTruthy();
    expect(screen.getByText(/Drop audio files here or/)).toBeTruthy();
    expect(screen.getByText('browse')).toBeTruthy();
    expect(screen.getByText('MP3, WAV, M4A')).toBeTruthy();

    // Section 3: Current queue
    expect(screen.getByText('Current queue')).toBeTruthy();
    expect(screen.getByText('Fireplace Ambience')).toBeTruthy();
    expect(screen.getByText('by Undone · 45:12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear queue' })).toBeTruthy();

    // Footer note
    expect(screen.getByText('Only you can manage your music')).toBeTruthy();
  });

  it('link input accepts URL and triggers submit with valid link', () => {
    const onSetMusic = vi.fn();
    const onNotify = vi.fn();

    render(
      <MusicSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onSetMusic={onSetMusic}
        onNotify={onNotify}
      />
    );

    const input = screen.getByPlaceholderText(
      'Paste a YouTube, Spotify, or playlist link'
    );
    const submitBtn = screen.getByRole('button', { name: 'Add to room' });

    // Type YouTube URL
    fireEvent.change(input, {
      target: { value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
    });
    expect((input as HTMLInputElement).value).toBe(
      'https://www.youtube.com/watch?v=jfKfPfyJRdk'
    );

    // Submit
    fireEvent.click(submitBtn);

    expect(onSetMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'youtube',
        kind: 'video',
        id: 'jfKfPfyJRdk',
      })
    );
    expect(onNotify).toHaveBeenCalledWith('Added to room music.');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('displays error message for invalid link', () => {
    const onSetMusic = vi.fn();

    render(
      <MusicSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onSetMusic={onSetMusic}
      />
    );

    const input = screen.getByPlaceholderText(
      'Paste a YouTube, Spotify, or playlist link'
    );
    const submitBtn = screen.getByRole('button', { name: 'Add to room' });

    // Invalid url
    fireEvent.change(input, {
      target: { value: 'https://invalid-website.com/audio.mp3' },
    });
    fireEvent.click(submitBtn);

    expect(onSetMusic).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'Only YouTube and Spotify links are supported.'
    );

    // Empty submission error
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(submitBtn);
    expect(screen.getByRole('alert').textContent).toBe(
      'Paste a YouTube or Spotify link.'
    );
  });

  it('handles clearing the queue', () => {
    const onClearQueue = vi.fn();
    const onSetMusic = vi.fn();

    render(
      <MusicSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onClearQueue={onClearQueue}
        onSetMusic={onSetMusic}
      />
    );

    expect(screen.getByText('Fireplace Ambience')).toBeTruthy();
    const clearBtn = screen.getByRole('button', { name: 'Clear queue' });
    fireEvent.click(clearBtn);

    expect(onClearQueue).toHaveBeenCalled();
    expect(onSetMusic).toHaveBeenCalledWith(null);
    expect(screen.getByText('Queue is empty')).toBeTruthy();
  });

  it('handles file upload selection', () => {
    const onUploadAudio = vi.fn();
    const onNotify = vi.fn();

    render(
      <MusicSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onUploadAudio={onUploadAudio}
        onNotify={onNotify}
      />
    );

    const file = new File(['fake-audio-content'], 'lofi-beats.mp3', {
      type: 'audio/mp3',
    });
    const dropzone = screen.getByRole('button', {
      name: 'Drop audio files here or browse',
    });
    const fileInput = dropzone.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onUploadAudio).toHaveBeenCalledWith(file);
    expect(onNotify).toHaveBeenCalledWith('Uploaded lofi-beats.mp3');
    expect(screen.getByText('lofi-beats')).toBeTruthy();
  });

  it('handles drag and drop upload', () => {
    const onUploadAudio = vi.fn();

    render(
      <MusicSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onUploadAudio={onUploadAudio}
      />
    );

    const dropzone = screen.getByRole('button', {
      name: 'Drop audio files here or browse',
    });
    const file = new File(['fake-audio'], 'chill-study.wav', {
      type: 'audio/wav',
    });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(onUploadAudio).toHaveBeenCalledWith(file);
    expect(screen.getByText('chill-study')).toBeTruthy();
  });

  it('calls onClose when close button, overlay, or Escape key is pressed', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <MusicSettingsModal isOpen={true} onClose={onClose} />
    );

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Overlay click
    const overlay = screen.getByTestId('music-settings-modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(3);

    // When isOpen is false, nothing is rendered
    rerender(<MusicSettingsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
