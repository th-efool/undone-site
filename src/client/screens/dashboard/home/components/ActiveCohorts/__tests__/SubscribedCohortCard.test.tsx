/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscribedCohortCard } from '../SubscribedCohortCard';
import type { ActiveCohort } from '../../../models';

vi.mock('next/image', () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <span data-testid="mock-img" data-src={props.src} /> }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
const cohort: ActiveCohort = { id: 'c1', rank: 1, title: 'Systems', provider: 'Undone', thumbnail: '/cover.jpg', minutesToday: 0, dailyGoalMinutes: 20, progressPercent: 42, schedule: { days: ['Mon'], label: 'Mon' } };
function setup(value = cohort, save = vi.fn().mockResolvedValue(undefined), remove = vi.fn().mockResolvedValue(undefined)) {
  const pause = vi.fn(), resume = vi.fn();
  render(<SubscribedCohortCard cohort={value} onPause={pause} onResume={resume} onSave={save} onDelete={remove} />);
  return { pause, resume, save, remove };
}
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('cohort card controls', () => {
  it('toggles pause directly from the play icon and never displays Paused as text', async () => {
    const { pause } = setup();
    expect(screen.getByRole('link', { name: 'Open Systems' }).getAttribute('href')).toBe('/cohort/c1');
    expect(screen.queryByText('Paused')).toBeNull();
    const btn = screen.getByRole('button', { name: 'Pause Systems' });
    expect(btn.getAttribute('data-paused')).toBeNull();
    fireEvent.click(btn);
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('shows pause button in orange when paused, never displays Paused as text, and resumes directly on click', async () => {
    const { resume } = setup({ ...cohort, pausedUntil: new Date(Date.now() + 86400000).toISOString() });
    expect(screen.queryByText('Paused')).toBeNull();
    const resumeBtn = screen.getByRole('button', { name: 'Resume Systems' });
    expect(resumeBtn.getAttribute('data-paused')).toBe('true');
    fireEvent.click(resumeBtn);
    expect(resume).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Resume Systems' }) as HTMLButtonElement).disabled).toBe(false));
  });
  it('supports scheduled pause options from the actions menu', async () => {
    const { pause } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cohort actions for Systems' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause options…' }));
    expect(screen.getByRole('dialog', { name: 'Pause options for Systems' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1 week' }));
    expect(pause).toHaveBeenCalledOnce();
    expect(pause.mock.calls[0][0].getTime() - Date.now()).toBeGreaterThan(6 * 86400000);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('accepts a calendar date without a time field and covers the selected local day', async () => {
    const { pause } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cohort actions for Systems' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause options…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom date' }));
    const date = new Date(); date.setDate(date.getDate() + 3);
    const value = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const input = screen.getByLabelText('Pause through');
    expect(input.getAttribute('type')).toBe('date');
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest('form')!);
    const until: Date = pause.mock.calls[0][0];
    expect(until.getHours()).toBe(0);
    expect(until.getDate()).toBe(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getDate());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('shows Edit and Delete, saves settings, and requires confirmation before removal', async () => {
    const { save, remove } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cohort actions for Systems' }));
    expect(screen.queryByRole('menuitem', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.queryByText('Shows up')).toBeNull();
    fireEvent.change(screen.getByLabelText('Daily goal (minutes)'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ dailyGoalMinutes: 45 })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Cohort actions for Systems' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove subscription' }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });
  it('dismisses on Escape and outside pointer interaction, and keeps failed saves open', async () => {
    setup(cohort, vi.fn().mockRejectedValue(new Error('offline')));
    const trigger = screen.getByRole('button', { name: 'Cohort actions for Systems' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('disables mutation controls when disabled is true while preserving navigation link', () => {
    const pause = vi.fn(), resume = vi.fn();
    render(<SubscribedCohortCard cohort={cohort} disabled={true} onPause={pause} onResume={resume} onSave={vi.fn()} onDelete={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'Open Systems' });
    expect(link.getAttribute('href')).toBe('/cohort/c1');

    const pauseBtn = screen.getByRole('button', { name: 'Pause Systems' }) as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(true);

    const menuBtn = screen.getByRole('button', { name: 'Cohort actions for Systems' }) as HTMLButtonElement;
    expect(menuBtn.disabled).toBe(true);

    fireEvent.click(pauseBtn);
    expect(pause).not.toHaveBeenCalled();

    fireEvent.click(menuBtn);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
