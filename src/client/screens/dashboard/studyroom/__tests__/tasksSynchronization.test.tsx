/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';
import { tasksStorageAdapter } from '@/src/client/repositories/tasksStorageAdapter';
import { SessionPanel } from '../room/components/SessionPanel';
import { usePersonalTasks } from '../hooks/usePersonalTasks';
import { useSessionGoal } from '../hooks/useSessionGoal';

function SessionPanelWrapper() {
  const goal = useSessionGoal();
  const tasks = usePersonalTasks();
  return <SessionPanel goal={goal} tasks={tasks} />;
}

describe('Tasks Synchronization across Study Room, Notes, and Home', () => {
  beforeEach(() => {
    tasksStorageAdapter.resetToDefault();
  });

  afterEach(() => {
    cleanup();
  });

  it('ensures session tasks are empty by default', () => {
    render(<SessionPanelWrapper />);

    // Session tasks should have no items by default
    expect(
      screen.getByText("No tasks yet. Add the first thing you'll do this session.")
    ).toBeDefined();

    // The counter like "2 / 4" should NOT be present when empty
    expect(screen.queryByText('2 / 4')).toBeNull();
  });

  it('renders unified tasks for the selected date (October 20)', () => {
    render(<SessionPanelWrapper />);

    // Check that unified October 20 tasks appear
    expect(screen.getByText('Review system design fundamentals')).toBeDefined();
    expect(screen.getByText('Read 20 pages')).toBeDefined();
    expect(screen.getByText('Solve 3 LeetCode problems')).toBeDefined();
    expect(screen.getByText('Write summary notes')).toBeDefined();
    expect(screen.getByText('Watch DB indexing video')).toBeDefined();
  });

  it('adding a task in Tasks & Goal updates the unified store for Notes and Home', async () => {
    render(<SessionPanelWrapper />);

    // Click "Add" button to open inline form
    const addBtn = screen.getByRole('button', { name: 'Add daily task' });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText('New daily task...');
    fireEvent.change(input, { target: { value: 'Sync Test Across All Routes' } });
    fireEvent.submit(input.closest('form')!);

    // New task should appear in UI
    expect(screen.getByText('Sync Test Across All Routes')).toBeDefined();

    // Verify task is in the shared unified store
    const unified = tasksStorageAdapter.getTasks();
    const created = unified.find((t) => t.title === 'Sync Test Across All Routes');
    expect(created).toBeDefined();
    expect(created?.month).toBe(9); // October
    expect(created?.day).toBe(20);
  });

  it('adding a task from external source (Notes/Home) immediately updates the Study Room UI', async () => {
    render(<SessionPanelWrapper />);

    // Simulate task added from /notes or /home for October 20
    act(() => {
      tasksStorageAdapter.addTask({
        title: 'Added From Notes Screen',
        category: 'Notes',
        year: 2026,
        month: 9,
        day: 20,
        status: 'pending',
      });
    });

    // Should immediately show up in the rendered SessionPanel
    await waitFor(() => {
      expect(screen.getByText('Added From Notes Screen')).toBeDefined();
    });
  });

  it('allows adding a daily task to the active session tasks', () => {
    render(<SessionPanelWrapper />);

    // Initially 0 session tasks
    expect(
      screen.getByText("No tasks yet. Add the first thing you'll do this session.")
    ).toBeDefined();

    // Click "+" on "Review system design fundamentals"
    const addActionBtn = screen.getByRole('button', {
      name: 'Add "Review system design fundamentals" to session',
    });
    fireEvent.click(addActionBtn);

    // Now it is in session tasks!
    const sessionTasksList = screen.getByRole('list', { name: 'Task list' });
    expect(sessionTasksList).toBeDefined();
    expect(screen.getByText('1 / 4')).toBeDefined();
  });
});
