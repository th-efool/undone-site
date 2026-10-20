'use client';

import React from 'react';
import type { usePersonalTasks } from '../../hooks/usePersonalTasks';
import type { useSessionGoal } from '../../hooks/useSessionGoal';
import GoalEditor from './GoalEditor';
import TaskList from './TaskList';
import DemoDataNote from './DemoDataNote';
import styles from './SessionPanel.module.css';

export interface SessionPanelProps {
  goal: ReturnType<typeof useSessionGoal>;
  tasks: ReturnType<typeof usePersonalTasks>;
}

export function SessionPanel({ goal, tasks }: SessionPanelProps) {
  return (
    <div className={styles.panel}>
      <GoalEditor goal={goal} />
      <TaskList tasks={tasks} />
      <DemoDataNote />
    </div>
  );
}

export default SessionPanel;
