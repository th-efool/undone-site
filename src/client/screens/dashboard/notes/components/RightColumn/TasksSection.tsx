import { Circle, CheckCircle2, ChevronDown, ChevronRight, Trash2, Plus } from 'lucide-react';
import { useState, KeyboardEvent, FormEvent } from 'react';
import styles from './RightColumn.module.css';

export interface Task {
  id: string | number;
  title: string;
  date: string;
  status: 'completed' | 'pending';
  noteId?: string;
  category?: string;
  color?: string;
}

export interface TasksSectionProps {
  tasks: Task[];
  setTasks?: (tasks: Task[]) => void;
  onToggleStatus?: (id: string | number) => void;
  onDeleteTask?: (id: string | number) => void;
  onEditTask?: (id: string | number, newTitle: string) => void;
  onAddTask?: (title: string) => void;
  onTaskClick?: (task: Task) => void;
}

export function TasksSection({
  tasks,
  setTasks,
  onToggleStatus,
  onDeleteTask,
  onEditTask,
  onAddTask,
  onTaskClick,
}: TasksSectionProps) {
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [newDraft, setNewDraft] = useState('');

  const toggleTaskStatus = (id: string | number) => {
    if (onToggleStatus) {
      onToggleStatus(id);
      return;
    }
    if (setTasks) {
      setTasks(
        tasks.map((t) =>
          t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
        )
      );
    }
  };

  const deleteTask = (id: string | number) => {
    if (onDeleteTask) {
      onDeleteTask(id);
      return;
    }
    if (setTasks) {
      setTasks(tasks.filter((t) => t.id !== id));
    }
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditValue(task.title);
  };

  const saveEdit = (id: string | number) => {
    const cleaned = editValue.trim();
    if (cleaned) {
      if (onEditTask) {
        onEditTask(id, cleaned);
      } else if (setTasks) {
        setTasks(tasks.map((t) => (t.id === id ? { ...t, title: cleaned } : t)));
      }
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, id: string | number) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleCreateTask = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = newDraft.trim();
    if (!cleaned) return;
    if (onAddTask) {
      onAddTask(cleaned);
    }
    setNewDraft('');
    setShowAddInput(false);
  };

  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
          onClick={() => setIsSectionExpanded(!isSectionExpanded)}
        >
          <span className={styles.sectionChevron}>
            {isSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className={styles.sectionTitle}>Tasks</span>
        </div>
        {onAddTask && (
          <button
            type="button"
            className={styles.iconButtonSmall}
            onClick={(e) => {
              e.stopPropagation();
              setShowAddInput((prev) => !prev);
            }}
            aria-label="Add task"
            title="Add task"
          >
            <Plus size={13} />
          </button>
        )}
      </header>

      {isSectionExpanded && (
        <div className={styles.sectionListContainer}>
          {showAddInput && (
            <form
              onSubmit={handleCreateTask}
              style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <input
                type="text"
                value={newDraft}
                onChange={(e) => setNewDraft(e.target.value)}
                placeholder="New task..."
                className={styles.renameInput}
                autoFocus
              />
              <button
                type="submit"
                className={styles.textButton}
                style={{ padding: '2px 8px', fontSize: '12px' }}
              >
                Add
              </button>
            </form>
          )}

          <div className={styles.tasksList}>
            {tasks.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No tasks yet.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={styles.taskItem}
                  onClick={() => onTaskClick?.(task)}
                  style={{ cursor: onTaskClick ? 'pointer' : 'default' }}
                >
                  <div
                    className={styles.taskStatus}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskStatus(task.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 size={16} className={styles.completedIcon} />
                    ) : (
                      <Circle size={16} className={styles.pendingIcon} />
                    )}
                  </div>

                  {editingId === task.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(task.id)}
                      onKeyDown={(e) => handleKeyDown(e, task.id)}
                      className={styles.renameInput}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`${styles.taskTitle} ${task.status === 'completed' ? styles.completedText : ''}`}
                      onDoubleClick={() => startEditing(task)}
                      style={{ cursor: 'text' }}
                      title="Double click to edit"
                    >
                      {task.title}
                    </span>
                  )}

                  <span className={styles.taskDate}>{task.date}</span>

                  <div
                    className={styles.taskActions}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
