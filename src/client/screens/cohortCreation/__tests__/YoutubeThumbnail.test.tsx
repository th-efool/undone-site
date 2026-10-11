// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { YoutubeThumbnail } from '../components/YoutubeThumbnail';

afterEach(cleanup);
describe('source video thumbnails', () => {
  it('derives public artwork from canonical identity and declares landscape dimensions', () => {
    const view = render(<YoutubeThumbnail videoId="dQw4w9WgXcQ" />);
    const image = view.container.querySelector('img')!;
    expect(image.src).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(Number(image.width) / Number(image.height)).toBeCloseTo(16 / 9);
    expect(image.alt).toBe('');
  });
  it('uses a neutral fallback on failure and loads new artwork after source switching', () => {
    const view = render(<YoutubeThumbnail videoId="dQw4w9WgXcQ" />);
    fireEvent.error(view.container.querySelector('img')!);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.querySelector('svg')).toBeTruthy();
    view.rerender(<YoutubeThumbnail videoId="AAAAAAAAAAA" />);
    expect(view.container.querySelector('img')?.src).toContain('/AAAAAAAAAAA/');
  });
  it('does not turn arbitrary unit IDs or URLs into image requests', () => {
    const view = render(<YoutubeThumbnail videoId="https://example.com/private" />);
    expect(view.container.querySelector('img')).toBeNull();
  });
});
