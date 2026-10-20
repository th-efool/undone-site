'use client';

import React, { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { PersonalTask } from '../../types';
import type { usePersonalTasks } from '../../hooks/usePersonalTasks';
import styles from './SessionPanel.module.css';

export interface TaskListProps {
  tasks: ReturnType<typeof usePersonalTasks>;
}

export function TaskList({ tasks }: TaskListProps) {
  const {
    tasks: items,
    draft,
    setDraft,
    error: hookError,
    add,
    toggle,
    edit,
    remove,
    move,
    clearCompleted,
  } = tasks;

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement | null>(null);
  const checkboxRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const doneCount = items.filter((t) => t.done).length;
  const totalCount = items.length;

  const startEdit = (task: PersonalTask) => {
    setEditingTaskId(task.id);
    setEditDraft(task.text);
    setEditError(null);
  };

  const handleCommitEdit = (id: string) => {
    const cleaned = editDraft.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setEditError("A task can't be empty.");
      return;
    }

    edit(id, cleaned);
    setEditingTaskId(null);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditError(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = add();
    if (success) {
      addInputRef.current?.focus();
    }
  };

  const handleDelete = (id: string, index: number) => {
    // Focus next task's checkbox if available, otherwise add input
    const nextTask = items[index + 1] ?? items[index - 1];
    remove(id);

    requestAnimationFrame(() => {
      if (nextTask && checkboxRefs.current.has(nextTask.id)) {
        checkboxRefs.current.get(nextTask.id)?.focus();
      } else {
        addInputRef.current?.focus();
      }
    });
  };

  return (
    <div className={styles.tasksSection}>
      <div className={styles.tasksHeader}>
        <h3 className={styles.tasksTitle}>Tasks</h3>
        <div className={styles.privacyLabel}>
          <Lock size={12} aria-hidden="true" />
          <span>Only you can see your tasks.</span>
        </div>
      </div>

      {totalCount > 0 && (
        <div className={styles.tasksStats}>
          <span>
            {doneCount} of {totalCount} done
          </span>
          {doneCount > 0 && (
            <button
              type="button"
              className={styles.clearCompletedBtn}
              onClick={clearCompleted}
            >
              Clear completed
            </button>
          )}
        </div>
      )}

      {totalCount === 0 ? (
        <div className={styles.emptyTasks} role="status">
          <p>No tasks yet. Add the first thing you&apos;ll do this session.</p>
        </div>
      ) : (
        <ul className={styles.taskList} aria-label="Task list">
          {items.map((task, index) => {
            const isEditing = editingTaskId === task.id;

            return (
              <li
                key={task.id}
                className={`${styles.taskItem} ${task.done ? styles.taskItemDone : ''}`}
              >
                {isEditing ? (
                  <div className={styles.editRow}>
                    <input
                      type="text"
                      className={styles.editInput}
                      value={editDraft}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCommitEdit(task.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelEdit();
                        }
                      }}
                      aria-label="Edit task text"
                    />
                    <button
                      type="button"
                      className={styles.taskActionBtn}
                      onClick={() => handleCommitEdit(task.id)}
                      aria-label="Save task"
                      title="Save"
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.taskActionBtn}
                      onClick={handleCancelEdit}
                      aria-label="Cancel editing"
                      title="Cancel"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={(el) => {
                        if (el) checkboxRefs.current.set(task.id, el);
                        else checkboxRefs.current.delete(task.id);
                      }}
                      type="checkbox"
                      id={`task-check-${task.id}`}
                      className={styles.taskCheckbox}
                      checked={task.done}
                      onChange={() => toggle(task.id)}
                      aria-label={task.text}
                    />

                    <label
                      htmlFor={`task-check-${task.id}`}
                      className={styles.taskText}
                      onDoubleClick={() => startEdit(task)}
                    >
                      {task.text}
                    </label>

                    <div className={styles.taskActions}>
                      <button
                        type="button"
                        className={styles.taskActionBtn}
                        onClick={() => move(task.id, 'up')}
                        disabled={index === 0}
                        aria-label="Move task up"
                        title="Move up"
                      >
                        <ChevronUp size={14} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className={styles.taskActionBtn}
                        onClick={() => move(task.id, 'down')}
                        disabled={index === items.length - 1}
                        aria-label="Move task down"
                        title="Move down"
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className={styles.taskActionBtn}
                        onClick={() => startEdit(task)}
                        aria-label="Edit task"
                        title="Edit"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className={`${styles.taskActionBtn} ${styles.taskDeleteBtn}`}
                        onClick={() => handleDelete(task.id, index)}
                        aria-label="Delete task"
                        title="Delete"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}

                {isEditing && editError && (
                  <p className={styles.inlineError} role="alert">
                    {editError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Sticky Bottom Add Row */}
      <form onSubmit={handleAddSubmit} className={styles.stickyAddRow}>
        <div className={styles.addForm}>
          <input
            ref={addInputRef}
            type="text"
            className={styles.addInput}
            placeholder="Add a task"
            maxLength={120}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={items.length >= 50}
            aria-label="Add a task"
          />
          <button
            type="submit"
            className={styles.addBtn}
            disabled={items.length >= 50}
            aria-label="Add task"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        {hookError && (
          <p className={styles.inlineError} role="alert">
            {hookError}
          </p>
        )}
      </form>
    </div>
  );
}

export default TaskList;
