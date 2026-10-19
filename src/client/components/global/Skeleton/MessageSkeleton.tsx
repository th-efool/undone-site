import React from 'react';
import styles from './Skeleton.module.css';

export function MessageSkeleton() {
  return (
    <div className={styles.messageSkeletonShell} aria-busy="true" aria-label="Loading messages">
      {/* Left sidebar: channels and conversations */}
      <div className={styles.messageSidebarSkeleton} data-testid="message-sidebar-skeleton">
        {/* Search bar placeholder */}
        <div className={styles.skeletonLine} style={{ width: '100%', height: '36px', borderRadius: '8px', marginBottom: '16px' }} />

        {/* Tab row */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div className={styles.skeletonLine} style={{ width: '50%', height: '28px', borderRadius: '6px' }} />
          <div className={styles.skeletonLine} style={{ width: '50%', height: '28px', borderRadius: '6px' }} />
        </div>

        {/* Conversation list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className={styles.skeletonLine} style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className={styles.skeletonLine} style={{ width: '60%', height: '14px' }} />
                <div className={styles.skeletonLine} style={{ width: '85%', height: '11px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat / social landing panel */}
      <div className={styles.messageMainSkeleton} data-testid="message-main-skeleton">
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div className={styles.skeletonLine} style={{ width: '220px', height: '28px' }} />
          <div className={styles.skeletonLine} style={{ width: '100px', height: '28px', borderRadius: '6px' }} />
        </div>

        {/* Chat message bubbles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <div style={{ alignSelf: 'flex-start', width: '55%', maxWidth: '420px' }}>
            <div className={styles.skeletonBlock} style={{ height: '56px', borderRadius: '12px' }} />
          </div>
          <div style={{ alignSelf: 'flex-end', width: '45%', maxWidth: '360px' }}>
            <div className={styles.skeletonBlock} style={{ height: '48px', borderRadius: '12px' }} />
          </div>
          <div style={{ alignSelf: 'flex-start', width: '60%', maxWidth: '460px' }}>
            <div className={styles.skeletonBlock} style={{ height: '64px', borderRadius: '12px' }} />
          </div>
        </div>

        {/* Message input bar */}
        <div className={styles.skeletonLine} style={{ width: '100%', height: '44px', borderRadius: '10px', marginTop: 'auto' }} />
      </div>
    </div>
  );
}
