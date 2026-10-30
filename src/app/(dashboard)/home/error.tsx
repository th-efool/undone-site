'use client';

import React from 'react';
import styles from '@/src/client/screens/dashboard/home/Home.module.css';

export default function HomeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.home} role="alert" aria-label="Error loading dashboard">
      <div className={styles.pageGrid}>
        <main className={styles.leftCol} style={{ textAlign: 'center', padding: '64px 16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
            Home could not load
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
            We encountered an issue loading your learning dashboard. Please try again.
          </p>
          <div>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
