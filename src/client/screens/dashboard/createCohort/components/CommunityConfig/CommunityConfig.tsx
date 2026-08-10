'use client';

import { Users } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import type { CommunityConfigModel } from '../../models/launch';

import styles from './CommunityConfig.module.css';

export function CommunityConfig() {
  const { launchState, actions } = useWizardContext();
  const community = launchState.community;

  const features: { key: keyof CommunityConfigModel; title: string; desc: string }[] = [
    { key: 'discussionFeed', title: 'Discussion Feed', desc: 'Allow learners to post updates and thoughts.' },
    { key: 'assignments', title: 'Assignments', desc: 'Enable assignment submissions and peer reviews.' },
    { key: 'projects', title: 'Projects Showcase', desc: 'Display student capstone projects.' },
    { key: 'publicNotes', title: 'Public Notes', desc: 'Allow sharing notes with cohort peers.' },
    { key: 'archives', title: 'Session Archives', desc: 'Store past recorded workshop videos.' },
    { key: 'hallOfFame', title: 'Hall of Fame', desc: 'Showcase top cohort achievements.' },
    { key: 'events', title: 'Community Events', desc: 'Schedule live Q&A office hours.' },
    { key: 'leaderboards', title: 'XP Leaderboards', desc: 'Gamified progress ranking.' },
    { key: 'communityChat', title: 'Real-time Chat', desc: 'Instant messaging channels.' },
    { key: 'qAndA', title: 'Q&A Forum', desc: 'Dedicated question & answer thread.' },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.titleGroup}>
        <Users size={16} color="#6366f1" />
        Community Feature Configuration
      </div>

      <div className={styles.grid}>
        {features.map((f) => (
          <div key={f.key} className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleTitle}>{f.title}</span>
              <span className={styles.toggleDesc}>{f.desc}</span>
            </div>

            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={Boolean(community[f.key])}
                onChange={() => actions.toggleCommunityFeature(f.key)}
              />
              <span className={styles.slider} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
