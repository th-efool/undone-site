'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle } from 'lucide-react';
import styles from './PlaySkeleton.module.css';

interface PlaySkeletonProps {
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function PlaySkeleton({ isError = false, errorMessage, onRetry }: PlaySkeletonProps) {
  if (isError) {
    return (
      <div className={styles.skeletonContainer}>
        <div className={styles.errorContainer} role="alert">
          <AlertCircle size={40} color="#EF4444" style={{ marginBottom: 16 }} />
          <h2 className={styles.errorTitle}>Lessons Could Not Be Loaded</h2>
          <p className={styles.errorDesc}>
            {errorMessage || "We encountered an issue fetching your feed items. Please check your connection and try reloading."}
          </p>
          <div className={styles.actionButtons}>
            {onRetry && (
              <button type="button" className={styles.retryBtn} onClick={onRetry}>
                <RefreshCw size={14} style={{ marginRight: 6, display: 'inline' }} />
                Reload Lessons
              </button>
            )}
            <Link href="/home" className={styles.homeLink}>
              Back Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.skeletonContainer} role="status" aria-label="Loading lessons">
      {/* 1. Top capsules skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className={styles.capsulesRow}>
          <div className={`${styles.capsule} ${styles.shimmer}`} />
          <div className={`${styles.capsule} ${styles.shimmer}`} />
          <div className={`${styles.capsule} ${styles.shimmer}`} />
          <div className={`${styles.capsule} ${styles.shimmer}`} />
        </div>

        {/* 2. Header metadata skeleton */}
        <div className={styles.headerContent}>
          <div className={styles.metadataSection}>
            <div className={`${styles.titleLine} ${styles.shimmer}`} />
            <div className={`${styles.subLine} ${styles.shimmer}`} />
          </div>
          <div className={styles.divider} />
          <div className={styles.episodeBlock}>
            <div className={`${styles.ringSkeleton} ${styles.shimmer}`} />
            <div className={styles.episodeText}>
              <div className={`${styles.codeLine} ${styles.shimmer}`} />
              <div className={`${styles.labelLine} ${styles.shimmer}`} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Center 16:9 stage & edge previews skeleton */}
      <div className={styles.stageArea}>
        <div className={`${styles.edgeCard} ${styles.leftEdge} ${styles.shimmer}`} />
        <div className={`${styles.centralSurface} ${styles.shimmer}`} />
        <div className={`${styles.edgeCard} ${styles.rightEdge} ${styles.shimmer}`} />
      </div>

      {/* 4. Bottom dock capsules skeleton */}
      <div className={styles.dockRow}>
        <div className={`${styles.dockCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.volumeCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.speedCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.shimmer}`} />
        <div className={`${styles.dockCapsule} ${styles.shimmer}`} />
      </div>
    </div>
  );
}
