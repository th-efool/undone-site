import { CheckSquare, Circle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import styles from './RightColumn.module.css';

const tasks = [
  { id: 1, title: 'Finalize Q2 Roadmap', date: 'Jun 5', status: 'completed' },
  { id: 2, title: 'Review System Architecture', date: 'Jun 8', status: 'completed' },
  { id: 3, title: 'Prepare Investor Deck', date: 'Jun 12', status: 'pending' },
  { id: 4, title: 'Update Onboarding Docs', date: 'Jun 18', status: 'completed' },
  { id: 5, title: 'Team Retrospective', date: 'Jun 24', status: 'completed' },
];

export function TasksSection() {
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);

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
      )}
    </div>
  );
}
