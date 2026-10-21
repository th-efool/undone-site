import { describe, it, expect, beforeEach } from 'vitest';
import { tasksStorageAdapter } from '../tasksStorageAdapter';

describe('tasksStorageAdapter', () => {
  beforeEach(() => {
    tasksStorageAdapter.resetToDefault();
  });

  it('loads initial default tasks', () => {
    const tasks = tasksStorageAdapter.getTasks();
    expect(tasks.length).toBeGreaterThan(0);
    const oct20Tasks = tasks.filter((t) => t.month === 9 && t.day === 20);
    expect(oct20Tasks.length).toBeGreaterThanOrEqual(5);
  });

  it('adds a new task and notifies subscribers', () => {
    let notified = false;
    const unsubscribe = tasksStorageAdapter.subscribe(() => {
      notified = true;
    });

    const newTask = tasksStorageAdapter.addTask({
      title: 'New Unit Test Task',
      category: 'Testing',
      year: 2026,
      month: 9,
      day: 20,
      status: 'pending',
    });

    expect(newTask.id).toBeDefined();
    expect(newTask.title).toBe('New Unit Test Task');
    expect(notified).toBe(true);

    const found = tasksStorageAdapter.getTasks().find((t) => t.id === newTask.id);
    expect(found).toBeDefined();

    unsubscribe();
  });

  it('updates task properties', () => {
    const tasks = tasksStorageAdapter.getTasks();
    const target = tasks[0];

    tasksStorageAdapter.updateTask(target.id, { title: 'Updated Title' });
    const updated = tasksStorageAdapter.getTasks().find((t) => t.id === target.id);
    expect(updated?.title).toBe('Updated Title');
  });

  it('toggles task status between pending and completed', () => {
    const tasks = tasksStorageAdapter.getTasks();
    const target = tasks[0];
    const initialStatus = target.status;

    tasksStorageAdapter.toggleTask(target.id);
    let updated = tasksStorageAdapter.getTasks().find((t) => t.id === target.id);
    expect(updated?.status).toBe(initialStatus === 'completed' ? 'pending' : 'completed');

    tasksStorageAdapter.toggleTask(target.id);
    updated = tasksStorageAdapter.getTasks().find((t) => t.id === target.id);
    expect(updated?.status).toBe(initialStatus);
  });

  it('removes a task', () => {
    const tasks = tasksStorageAdapter.getTasks();
    const target = tasks[0];

    tasksStorageAdapter.removeTask(target.id);
    const found = tasksStorageAdapter.getTasks().find((t) => t.id === target.id);
    expect(found).toBeUndefined();
  });
});
