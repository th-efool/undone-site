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

  describe('Account Isolation & Idempotent Import (Phase 10)', () => {
    beforeEach(() => {
      tasksStorageAdapter.setUserId(null);
      tasksStorageAdapter.resetToDefault(null);
    });

    it('isolates tasks between different user accounts', () => {
      tasksStorageAdapter.setUserId('user-alice');
      tasksStorageAdapter.addTask({
        title: "Alice's Secret Project",
        category: 'Work',
        year: 2026,
        month: 9,
        day: 20,
        status: 'pending',
      });

      expect(tasksStorageAdapter.getTasks().some((t) => t.title === "Alice's Secret Project")).toBe(true);

      // Switch to Bob's account
      tasksStorageAdapter.setUserId('user-bob');
      expect(tasksStorageAdapter.getTasks().some((t) => t.title === "Alice's Secret Project")).toBe(false);

      // Alice's task still exists in Alice's scope
      tasksStorageAdapter.setUserId('user-alice');
      expect(tasksStorageAdapter.getTasks().some((t) => t.title === "Alice's Secret Project")).toBe(true);
    });

    it('refuses to import local anonymous tasks without explicit confirmation', () => {
      expect(() => {
        tasksStorageAdapter.importLocalTasks('user-alice', false);
      }).toThrow(/Explicit confirmation required/);
    });

    it('idempotently imports anonymous local tasks upon confirmation', () => {
      tasksStorageAdapter.setUserId(null);
      const anonTasks = tasksStorageAdapter.getTasks();
      const initialAnonCount = anonTasks.length;
      expect(initialAnonCount).toBeGreaterThan(0);

      tasksStorageAdapter.setUserId('user-alice');
      tasksStorageAdapter.resetToDefault('user-alice'); // starts empty

      const result1 = tasksStorageAdapter.importLocalTasks('user-alice', true);
      expect(result1.importedCount).toBe(initialAnonCount);
      expect(tasksStorageAdapter.getTasks('user-alice').length).toBe(initialAnonCount);

      // Re-running import should be idempotent (0 newly imported)
      const result2 = tasksStorageAdapter.importLocalTasks('user-alice', true);
      expect(result2.importedCount).toBe(0);
    });

    it('clears user cache on logout without affecting other accounts', () => {
      tasksStorageAdapter.setUserId('user-alice');
      tasksStorageAdapter.addTask({
        title: 'Temporary Note Task',
        year: 2026,
        month: 9,
        day: 20,
        status: 'pending',
      });

      tasksStorageAdapter.clearUserCache('user-alice');
      expect(tasksStorageAdapter.getTasks('user-alice').length).toBe(0);

      // Switch to anonymous -> sees default anonymous tasks
      tasksStorageAdapter.setUserId(null);
      expect(tasksStorageAdapter.getTasks().length).toBeGreaterThan(0);
    });
  });
});
