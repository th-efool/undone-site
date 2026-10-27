// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MediaOverlay, MediaOverlayElement } from '../MediaOverlay';

afterEach(cleanup);

describe('MediaOverlay - Excalidraw Issues #5301 & #8776 Resolution', () => {
  it('renders nothing when scene has no media elements', () => {
    const elements: MediaOverlayElement[] = [
      {
        id: 'rect-1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      },
    ];

    const { container } = render(
      <MediaOverlay
        elements={elements}
        scrollX={0}
        scrollY={0}
        zoom={1}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders animated GIF embeddable in hardware-accelerated 3D transform layer (#5301)', () => {
    const elements: MediaOverlayElement[] = [
      {
        id: 'gif-1',
        type: 'embeddable',
        x: 150,
        y: 200,
        width: 400,
        height: 300,
        link: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        assetMimeType: 'image/gif',
      },
    ];

    const { container } = render(
      <MediaOverlay
        elements={elements}
        scrollX={50}
        scrollY={100}
        zoom={1.5}
      />
    );

    // Verify transform layer uses 3D transform for GPU composition
    const transformLayer = container.querySelector('.excalidraw-media-overlay-transform-layer') as HTMLElement;
    expect(transformLayer).not.toBeNull();
    expect(transformLayer.style.transform).toBe('translate3d(75px, 150px, 0) scale(1.5)');

    // Verify img rendered with transparent background (#8776)
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('data:image/gif;base64');
    expect(img.style.background).toBe('transparent');
    expect(img.style.objectFit).toBe('contain');
  });

  it('isolates pointer events when unselected and enables pointer events when selected', () => {
    const elements: MediaOverlayElement[] = [
      {
        id: 'media-elem-1',
        type: 'embeddable',
        x: 50,
        y: 50,
        width: 200,
        height: 200,
        link: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      },
    ];

    // 1. Unselected -> pointer-events: none
    const { container, rerender } = render(
      <MediaOverlay
        elements={elements}
        scrollX={0}
        scrollY={0}
        zoom={1}
        selectedElementIds={{}}
      />
    );

    const item = container.querySelector('.media-overlay-item') as HTMLElement;
    expect(item.style.pointerEvents).toBe('none');

    // 2. Selected -> pointer-events: auto
    rerender(
      <MediaOverlay
        elements={elements}
        scrollX={0}
        scrollY={0}
        zoom={1}
        selectedElementIds={{ 'media-elem-1': true }}
      />
    );

    expect(item.style.pointerEvents).toBe('auto');
  });

  it('renders video media with playsInline, loop, and muted by default', () => {
    const elements: MediaOverlayElement[] = [
      {
        id: 'video-elem-1',
        type: 'embeddable',
        x: 100,
        y: 100,
        width: 480,
        height: 270,
        link: 'data:video/mp4;base64,AAAA',
        assetMimeType: 'video/mp4',
      },
    ];

    const { container } = render(
      <MediaOverlay
        elements={elements}
        scrollX={0}
        scrollY={0}
        zoom={1}
      />
    );

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.style.background).toBe('transparent');
  });
});
