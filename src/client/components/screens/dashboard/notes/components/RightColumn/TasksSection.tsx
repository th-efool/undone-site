import { CheckSquare, Plus, MoreHorizontal, Circle, CheckCircle2 } from 'lucide-react';
import styles from './RightColumn.module.css';

const tasks = [
  { id: 1, title: 'Finalize Q2 Roadmap', date: 'Jun 5', status: 'completed' },
  { id: 2, title: 'Review System Architecture', date: 'Jun 8', status: 'completed' },
  { id: 3, title: 'Prepare Investor Deck', date: 'Jun 12', status: 'pending' },
  { id: 4, title: 'Update Onboarding Docs', date: 'Jun 18', status: 'completed' },
  { id: 5, title: 'Team Retrospective', date: 'Jun 24', status: 'completed' },
];

export function TasksSection() {
  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <CheckSquare size={16} className={styles.sectionIcon} />
          <span>Tasks</span>
        </div>
        <div className={styles.sectionControls}>
          <button className={styles.textButton}>
            <Plus size={14} /> New task
          </button>
          <button className={styles.iconButtonSmall}>
            <MoreHorizontal size={14} />
          </button>
        </div>
      </header>
      
      <div className={styles.tasksList}>
        {tasks.map(task => (
          <div key={task.id} className={styles.taskItem}>
            <div className={styles.taskStatus}>
              {task.status === 'completed' ? (
                <CheckCircle2 size={16} className={styles.completedIcon} />
              ) : (
                <Circle size={16} className={styles.pendingIcon} />
              )}
            </div>
            <span className={`${styles.taskTitle} ${task.status === 'completed' ? styles.completedText : ''}`}>
              {task.title}
            </span>
            <span className={styles.taskDate}>{task.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
