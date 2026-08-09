import React from 'react';
import styles from '../Notes.module.css';

export const TasksPanel = () => {
  const tasks = [
    { id: 1, name: 'Finalize Q2 Roadmap', date: 'Jun 5', type: 'normal' },
    { id: 2, name: 'Review System Architecture', date: 'Jun 8', type: 'accent' },
    { id: 3, name: 'Prepare Investor Deck', date: 'Jun 12', type: 'active' },
    { id: 4, name: 'Update Onboarding Docs', date: 'Jun 18', type: 'normal' },
    { id: 5, name: 'Team Retrospective', date: 'Jun 24', type: 'normal' },
  ];

  return (
    <div className={styles.tasksPanelContainer}>
      <div className={styles.tasksPanelHeader}>
        <div className={styles.tasksPanelHeaderLeft}>
          <span className={styles.tasksPanelHeaderTitle}>✓ Tasks</span>
        </div>
        <div className={styles.tasksPanelHeaderRight}>
          <button className={styles.tasksPanelNewTask}>+ New task</button>
          <button className={styles.iconButton}>⋮</button>
        </div>
      </div>
      <div className={styles.tasksPanelList}>
        {tasks.map(task => (
          <div key={task.id} className={styles.taskRow}>
            <input type="checkbox" className={styles.taskCheckbox} />
            <span className={styles.taskName}>{task.name}</span>
            <div className={`${styles.taskDate} ${styles[`taskDate_${task.type}`]}`}>
              {task.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
