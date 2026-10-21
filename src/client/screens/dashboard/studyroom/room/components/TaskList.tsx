'use client';

import React, { useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { PersonalTask } from '../../types';
import type { usePersonalTasks } from '../../hooks/usePersonalTasks';
import styles from './SessionPanel.module.css';

export interface TaskListProps {
  tasks: ReturnType<typeof usePersonalTasks>;
  selectedDateLabel?: string;
  onAddFromDaily?: () => void;
}

const TASK_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
];

const KNOWN_COLORS: Record<string, string> = {
  'review system design fundamentals': '#3b82f6',
  'read 20 pages': '#a855f7',
  'solve 3 leetcode problems': '#22c55e',
  'write summary notes': '#eab308',
  'watch db indexing video': '#f97316',
};

function getTaskColor(index: number, text: string): string {
  const lower = text.trim().toLowerCase();
  if (KNOWN_COLORS[lower]) {
    return KNOWN_COLORS[lower];
  }
  return TASK_COLORS[index % TASK_COLORS.length];
}

export function TaskList({ tasks, selectedDateLabel = '20th October', onAddFromDaily }: TaskListProps) {
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
        <h3 className={styles.tasksTitle}>Session Tasks</h3>
        <div className={styles.tasksHeaderRight}>
          <div className={styles.privacyLabel}>
            <Lock size={12} aria-hidden="true" />
            <span>Only you can see your tasks.</span>
          </div>
          {totalCount > 0 && (
            <span className={styles.tasksStats}>
              {doneCount} of {totalCount} done
            </span>
          )}
          {totalCount > 0 && (
            <span className={styles.sessionCounter} aria-hidden="true">
              {totalCount} / 4
            </span>
          )}
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
      </div>

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
                role="listitem"
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
                    <div className={styles.taskItemLeft}>
                      <span className={styles.dragHandle} aria-hidden="true">
                        <GripVertical size={16} />
                      </span>

                      <div className={styles.moveBtnGroup}>
                        <button
                          type="button"
                          className={styles.moveBtn}
                          onClick={() => move(task.id, 'up')}
                          disabled={index === 0}
                          aria-label="Move task up"
                          title="Move up"
                        >
                          <ChevronUp size={11} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={styles.moveBtn}
                          onClick={() => move(task.id, 'down')}
                          disabled={index === items.length - 1}
                          aria-label="Move task down"
                          title="Move down"
                        >
                          <ChevronDown size={11} aria-hidden="true" />
                        </button>
                      </div>

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

                      <span
                        className={styles.taskColorDot}
                        style={{ backgroundColor: getTaskColor(index, task.text) }}
                        aria-hidden="true"
                      />

                      <label
                        htmlFor={`task-check-${task.id}`}
                        className={styles.taskText}
                        onDoubleClick={() => startEdit(task)}
                      >
                        {task.text}
                      </label>
                    </div>

                    <div className={styles.taskItemRight}>
                      <span className={styles.dateBadge}>
                        <Calendar size={11} aria-hidden="true" />
                        <span>Oct 20</span>
                      </span>

                      <button
                        type="button"
                        className={styles.taskPlayBtn}
                        aria-label="Start task"
                        title="Start"
                      >
                        <Play size={11} fill="currentColor" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className={styles.taskActionBtn}
                        onClick={() => startEdit(task)}
                        aria-label="Edit task"
                        title="Edit"
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className={`${styles.taskActionBtn} ${styles.taskDeleteBtn}`}
                        onClick={() => handleDelete(task.id, index)}
                        aria-label="Delete task"
                        title="Delete"
                      >
                        <Trash2 size={13} aria-hidden="true" />
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

      {/* Button: + Add from 20th October Tasks */}
      {onAddFromDaily && (
        <button
          type="button"
          className={styles.addFromDailyBtn}
          onClick={onAddFromDaily}
        >
          <Plus size={15} aria-hidden="true" />
          <span>+ Add from {selectedDateLabel} Tasks</span>
        </button>
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
