'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import styles from './authProviders.module.css';

type Provider = {
  id: string;
  name: string;
  icon: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '/logos/google.webp',
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: '/logos/apple.webp',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '/logos/github.webp',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '/logos/slack.webp',
  },
];

export function AuthProviders() {
  return (
    <div className={styles.providers}>
      {PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          type="button"
          className={styles.provider}
          onClick={() => signIn(provider.id, { callbackUrl: '/home' })}
          disabled={provider.id === 'google' || provider.id === 'apple'}
          style={provider.id === 'google' || provider.id === 'apple' ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <Image
            src={provider.icon}
            alt=""
            width={22}
            height={22}
          />

          <span>{provider.name}</span>
        </button>
      ))}
    </div>
  );
}
