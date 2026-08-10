import { Users, MessageCircle, Bell, TrendingUp } from 'lucide-react';

import styles from './authHighlights.module.css';

type Highlight = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const HIGHLIGHTS: Highlight[] = [
  {
    title: 'Join Active Cohorts',
    description: 'Hop into any public cohort. People are already learning.',
    icon: <Users size={22} />,
  },

  {
    title: 'Share & Discuss',
    description: 'Notes, questions, ideas—attached to the material itself.',
    icon: <MessageCircle size={22} />,
  },

  {
    title: 'Nudge & Support',
    description: 'Friends gently nudge you when you fall behind. No pressure. Ever.',
    icon: <Bell size={22} />,
  },

  {
    title: 'See Real Progress',
    description: 'Track your growth compared to one learning alone.',
    icon: <TrendingUp size={22} />,
  },
];

export default function AuthHighlights() {
  return (
    <div className={styles.grid}>
      {HIGHLIGHTS.map((item) => (
        <article
          key={item.title}
          className={styles.card}
        >
          <div className={styles.icon}>{item.icon}</div>

          <div className={styles.content}>
            <h4>{item.title}</h4>

            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
