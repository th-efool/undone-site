import { siGithub, siLoom, siVimeo, siYoutube } from 'simple-icons';

import styles from './ProviderBadge.module.css';
import type { ContentProvider } from '@/src/client/components/global/ProviderBadge/types';

export interface ProviderBadgeProps {
  provider: ContentProvider;

  label?: string;

  className?: string;
}

const providers = {
  youtube: {
    icon: siYoutube,
    name: 'YouTube',
  },

  vimeo: {
    icon: siVimeo,
    name: 'Vimeo',
  },

  loom: {
    icon: siLoom,
    name: 'Loom',
  },

  github: {
    icon: siGithub,
    name: 'GitHub',
  },
} as const;

export function ProviderBadge({ provider, label = 'Saved from', className }: ProviderBadgeProps) {
  const config = providers[provider];

  return (
    <div className={`${styles.badge} ${className ?? ''}`}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={config.icon.path} />
      </svg>

      <span className={styles.label}>
        {label} {config.name}
      </span>
    </div>
  );
}
