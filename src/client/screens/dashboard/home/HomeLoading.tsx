import React from 'react';
import styles from './Home.module.css';

export function HomeLoading() {
  return (
    <div className={styles.home} role="status" aria-label="Loading dashboard">
      <div className={styles.pageGrid}>
        <main className={styles.leftCol}>
          <div
            style={{
              height: '80px',
              borderRadius: '12px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '140px',
              borderRadius: '16px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '240px',
              borderRadius: '16px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </main>
        <aside className={styles.rightRail}>
          <div
            style={{
              height: '260px',
              borderRadius: '16px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: '180px',
              borderRadius: '16px',
              background: 'rgba(0,0,0,0.04)',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </aside>
      </div>
    </div>
  );
}
