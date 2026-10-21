/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import SessionPanel from '../room/components/SessionPanel';
import { useSessionGoal } from '../hooks/useSessionGoal';
import { usePersonalTasks } from '../hooks/usePersonalTasks';
import type { PersonalTask, SessionGoal } from '../types';

function SessionPanelTestWrapper({
  initialGoal,
  initialTasks,
}: {
  initialGoal?: Partial<SessionGoal>;
  initialTasks?: PersonalTask[];
}) {
  const goal = useSessionGoal(initialGoal);
  const tasks = usePersonalTasks(initialTasks);
  return <SessionPanel goal={goal} tasks={tasks} />;
}

describe('SessionPanel integration', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Session Goal', () => {
    it('renders empty goal by default and updates draft on input', () => {
      render(<SessionPanelTestWrapper />);

      const goalInput = screen.getByLabelText("What's your goal for this session?") as HTMLInputElement;
      expect(goalInput.value).toBe('');
      expect(screen.getByText('0/80')).toBeTruthy();
      expect(screen.getByText('Only you can see this goal.')).toBeTruthy();

      fireEvent.change(goalInput, { target: { value: 'Write 500 words' } });
      expect(goalInput.value).toBe('Write 500 words');
      expect(screen.getByText('15/80')).toBeTruthy();
    });

    it('commits goal on blur or Save button and shows committed badge', () => {
      render(<SessionPanelTestWrapper />);

      const goalInput = screen.getByLabelText("What's your goal for this session?");
      fireEvent.change(goalInput, { target: { value: 'Complete chapter 3' } });

      const saveBtn = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveBtn);

      expect(screen.getByTitle('Complete chapter 3')).toBeTruthy();
    });

    it('switches visibility between private and room immediately with helper text update', () => {
      render(<SessionPanelTestWrapper initialGoal={{ text: 'Study physics', visibility: 'private' }} />);

      const privateRadio = screen.getByRole('radio', { name: /Private/ });
      const roomRadio = screen.getByRole('radio', { name: /Visible to room/ });

      expect(privateRadio.getAttribute('aria-checked')).toBe('true');
      expect(roomRadio.getAttribute('aria-checked')).toBe('false');
      expect(screen.getByText('Only you can see this goal.')).toBeTruthy();

      fireEvent.click(roomRadio);

      expect(privateRadio.getAttribute('aria-checked')).toBe('false');
      expect(roomRadio.getAttribute('aria-checked')).toBe('true');
      expect(
        screen.getByText('Everyone in this room can see this goal next to your name.')
      ).toBeTruthy();
    });
  });

  describe('Personal Tasks', () => {
    it('shows empty state when no tasks exist', () => {
      render(<SessionPanelTestWrapper />);

      expect(
        screen.getByText("No tasks yet. Add the first thing you'll do this session.")
      ).toBeTruthy();
      expect(screen.getByText('Only you can see your tasks.')).toBeTruthy();
    });

    it('adds a new task, trims whitespace, and appends to bottom', () => {
      render(<SessionPanelTestWrapper />);

      const addInput = screen.getByLabelText('Add a task') as HTMLInputElement;
      const addBtn = screen.getByRole('button', { name: 'Add task' });

      fireEvent.change(addInput, { target: { value: '   Review PR feedback   ' } });
      fireEvent.click(addBtn);

      expect(screen.queryByText("No tasks yet. Add the first thing you'll do this session.")).toBeNull();
      expect(screen.getByText('Review PR feedback')).toBeTruthy();
      expect(addInput.value).toBe('');
      expect(screen.getByText('0 of 1 done')).toBeTruthy();
    });

    it('rejects empty task add with error message', () => {
      render(<SessionPanelTestWrapper />);

      const addBtn = screen.getByRole('button', { name: 'Add task' });
      fireEvent.click(addBtn);

      expect(screen.getByRole('alert').textContent).toBe('Write something first.');
    });

    it('toggles task completion and displays Clear completed button', () => {
      const initialTasks: PersonalTask[] = [
        { id: 'task-1', text: 'Task 1', done: false, createdAt: Date.now() },
        { id: 'task-2', text: 'Task 2', done: false, createdAt: Date.now() },
      ];

      render(<SessionPanelTestWrapper initialTasks={initialTasks} />);

      expect(screen.getByText('0 of 2 done')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Clear completed' })).toBeNull();

      const checkbox1 = screen.getByRole('checkbox', { name: 'Task 1' });
      fireEvent.click(checkbox1);

      expect(screen.getByText('1 of 2 done')).toBeTruthy();

      const clearBtn = screen.getByRole('button', { name: 'Clear completed' });
      expect(clearBtn).toBeTruthy();

      fireEvent.click(clearBtn);

      expect(screen.queryByText('Task 1')).toBeNull();
      expect(screen.getByText('Task 2')).toBeTruthy();
      expect(screen.getByText('0 of 1 done')).toBeTruthy();
    });

    it('edits task inline with Save and Cancel', () => {
      const initialTasks: PersonalTask[] = [
        { id: 'task-1', text: 'Original text', done: false, createdAt: Date.now() },
      ];

      render(<SessionPanelTestWrapper initialTasks={initialTasks} />);

      const editBtn = screen.getByRole('button', { name: 'Edit task' });
      fireEvent.click(editBtn);

      const editInput = screen.getByLabelText('Edit task text') as HTMLInputElement;
      expect(editInput.value).toBe('Original text');

      fireEvent.change(editInput, { target: { value: 'Updated text' } });

      const saveBtn = screen.getByRole('button', { name: 'Save task' });
      fireEvent.click(saveBtn);

      expect(screen.getByText('Updated text')).toBeTruthy();
      expect(screen.queryByLabelText('Edit task text')).toBeNull();
    });

    it('cancels inline editing when Cancel button is clicked', () => {
      const initialTasks: PersonalTask[] = [
        { id: 'task-1', text: 'Original text', done: false, createdAt: Date.now() },
      ];

      render(<SessionPanelTestWrapper initialTasks={initialTasks} />);

      const editBtn = screen.getByRole('button', { name: 'Edit task' });
      fireEvent.click(editBtn);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel editing' });
      fireEvent.click(cancelBtn);

      expect(screen.getByText('Original text')).toBeTruthy();
      expect(screen.queryByLabelText('Edit task text')).toBeNull();
    });

    it('reorders tasks up and down with Chevron buttons', () => {
      const initialTasks: PersonalTask[] = [
        { id: 'task-1', text: 'Task 1', done: false, createdAt: Date.now() },
        { id: 'task-2', text: 'Task 2', done: false, createdAt: Date.now() },
      ];

      render(<SessionPanelTestWrapper initialTasks={initialTasks} />);

      const moveUpBtns = screen.getAllByRole('button', { name: 'Move task up' });
      const moveDownBtns = screen.getAllByRole('button', { name: 'Move task down' });

      // First item cannot move up
      expect(moveUpBtns[0].hasAttribute('disabled')).toBe(true);
      // Last item cannot move down
      expect(moveDownBtns[1].hasAttribute('disabled')).toBe(true);

      // Move task 2 up
      fireEvent.click(moveUpBtns[1]);

      const items = screen.getAllByRole('listitem');
      expect(items[0].textContent).toContain('Task 2');
      expect(items[1].textContent).toContain('Task 1');
    });

    it('deletes task when Trash button is clicked', () => {
      const initialTasks: PersonalTask[] = [
        { id: 'task-1', text: 'Task 1', done: false, createdAt: Date.now() },
      ];

      render(<SessionPanelTestWrapper initialTasks={initialTasks} />);

      const deleteBtn = screen.getByRole('button', { name: 'Delete task' });
      fireEvent.click(deleteBtn);

      expect(screen.queryByText('Task 1')).toBeNull();
      expect(
        screen.getByText("No tasks yet. Add the first thing you'll do this session.")
      ).toBeTruthy();
    });
  });

  describe('Mini Calendar & Daily Tasks', () => {
    it('renders October 2026 mini calendar and selects interactive days', () => {
      render(<SessionPanelTestWrapper />);

      expect(screen.getByText('October 2026')).toBeTruthy();
      expect(screen.getByRole('button', { name: /20 October 2026, selected/ })).toBeTruthy();
      expect(screen.getByText('20th October Tasks')).toBeTruthy();

      const day21 = screen.getByRole('button', { name: '21 October 2026' });
      fireEvent.click(day21);

      expect(screen.getByText('21st October Tasks')).toBeTruthy();
    });

    it('adds daily task to session when + button on daily task item is clicked', () => {
      render(<SessionPanelTestWrapper />);

      expect(screen.getByText('Review system design fundamentals')).toBeTruthy();
      const addDailyBtn = screen.getByRole('button', {
        name: 'Add "Review system design fundamentals" to session',
      });
      fireEvent.click(addDailyBtn);

      expect(
        screen.queryByText("No tasks yet. Add the first thing you'll do this session.")
      ).toBeNull();
      expect(screen.queryByText('1 of 1 done')).toBeNull();
      expect(screen.getByText('0 of 1 done')).toBeTruthy();
      expect(screen.getAllByText('Review system design fundamentals')).toHaveLength(2);
    });

    it('adds next daily task when "+ Add from 20th October Tasks" button is clicked', () => {
      render(<SessionPanelTestWrapper />);

      const addFromDailyBtn = screen.getByRole('button', {
        name: /\+ Add from 20th October Tasks/,
      });
      fireEvent.click(addFromDailyBtn);

      expect(screen.getAllByText('Review system design fundamentals')).toHaveLength(2);
      expect(screen.getByText('0 of 1 done')).toBeTruthy();
    });
  });
});
