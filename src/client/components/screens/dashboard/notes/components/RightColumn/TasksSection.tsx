import { Circle, CheckCircle2, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';
import styles from './RightColumn.module.css';

export interface Task {
  id: number;
  title: string;
  date: string;
  status: 'completed' | 'pending';
}

interface TasksSectionProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
}

export function TasksSection({ tasks, setTasks }: TasksSectionProps) {
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleTaskStatus = (id: number) => {
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    ));
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditValue(task.title);
  };

  const saveEdit = (id: number) => {
    if (editValue.trim()) {
      setTasks(tasks.map(t => t.id === id ? { ...t, title: editValue.trim() } : t));
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, id: number) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader} onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
        <span className={styles.sectionChevron}>
          {isSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.sectionTitle}>Tasks</span>
      </header>
      
      {isSectionExpanded && (
        <div className={styles.sectionListContainer}>
          <div className={styles.tasksList}>
            {tasks.map(task => (
              <div key={task.id} className={styles.taskItem}>
                <div 
                  className={styles.taskStatus} 
                  onClick={() => toggleTaskStatus(task.id)}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
