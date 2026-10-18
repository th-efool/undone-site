// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ExpeditionProgressCard } from '../ExpeditionProgressCard/ExpeditionProgressCard';
import { QuestGuideCard } from '../QuestGuideCard/QuestGuideCard';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('Overview Actions (ExpeditionProgressCard & QuestGuideCard)', () => {
  afterEach(() => {
    cleanup();
  });
  it('navigates to cohort questline when View My Activity is clicked with cohortId', () => {
    mockPush.mockClear();

    render(
      <ExpeditionProgressCard
        items={[{ id: '1', icon: 'lesson', label: 'Quests', value: '4' }]}
        cohortId="cohort-test-123"
      />,
    );

    const button = screen.getByRole('button', { name: /view my activity/i });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith('/cohort/cohort-test-123/questline');
  });

  it('navigates to /home when View My Activity is clicked without cohortId', () => {
    mockPush.mockClear();

    render(
      <ExpeditionProgressCard
        items={[{ id: '1', icon: 'lesson', label: 'Quests', value: '4' }]}
      />,
    );

    const button = screen.getByRole('button', { name: /view my activity/i });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith('/home');
  });

  it('renders link to community message channel in QuestGuideCard when cohortId is provided', () => {
    const creator = {
      id: 'cr-1',
      name: 'Dr. Jane',
      role: 'Professor',
      avatarUrl: '/mock/avatars/a.webp',
      bio: 'Expert in Algorithms',
      ctaLabel: 'Message Professor',
    };

    render(<QuestGuideCard creator={creator} cohortId="cohort-test-123" />);

    const link = screen.getByRole('link', { name: /message professor/i });
    expect(link.getAttribute('href')).toBe('/message?community=cohort-test-123');
  });

  it('renders link to /message in QuestGuideCard when cohortId is omitted', () => {
    const creator = {
      id: 'cr-1',
      name: 'Dr. Jane',
      role: 'Professor',
      avatarUrl: '/mock/avatars/a.webp',
      bio: 'Expert in Algorithms',
      ctaLabel: '',
    };

    render(<QuestGuideCard creator={creator} />);

    const link = screen.getByRole('link', { name: /message guide/i });
    expect(link.getAttribute('href')).toBe('/message');
  });
});
