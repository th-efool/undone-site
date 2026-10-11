// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { RecommendationResults } from '../components/RecommendationResults';
import { RecommendationCover } from '../components/RecommendationCover';
afterEach(cleanup);
describe('recommendation cover recovery', () => {
  it.each([null, 'not-a-url', 'javascript:alert(1)', '//foreign.example/image', '/\\foreign.example/image', 'https://user:secret@example.com/image'])('uses existing fallback for unsupported cover %s', src => {
    const view = render(<RecommendationCover src={src} featured />);
    expect(view.container.querySelector('img')).toBeNull(); expect(screen.getByLabelText(src ? 'Cover image unavailable' : 'No cover image')).toBeTruthy();
  });
  it('falls back on network failure and attempts a changed valid URL without retry loops', () => {
    const view = render(<RecommendationCover src="https://images.example/first.png" featured />);
    fireEvent.error(view.container.querySelector('img')!); expect(screen.getByLabelText('Cover image unavailable')).toBeTruthy();
    view.rerender(<RecommendationCover src="https://images.example/second.png" featured={false} />);
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('https://images.example/second.png');
    fireEvent.error(view.container.querySelector('img')!); expect(view.container.querySelector('img')).toBeNull();
  });
  it('keeps dynamic card content and join/create actions usable after a broken image', () => {
    const onCreateOwn = vi.fn(); const view = render(<RecommendationResults result={{ ...result, items: result.items.map(item => ({ ...item, cohort: { ...item.cohort, coverImage: '/images/broken-cover.png' } })) }} onCreateOwn={onCreateOwn} />);
    fireEvent.error(view.container.querySelector('img')!);
    expect(screen.getByRole('heading', { name: result.items[0].cohort.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: `Join ${result.items[0].cohort.title}` }).getAttribute('href')).toContain(result.items[0].cohort.cohortId);
    fireEvent.click(screen.getByRole('button', { name: /Create my own cohort/i })); expect(onCreateOwn).toHaveBeenCalledOnce();
  });
});
