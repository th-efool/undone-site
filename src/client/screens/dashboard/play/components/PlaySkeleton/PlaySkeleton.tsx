'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import styles from './PlaySkeleton.module.css';

interface PlaySkeletonProps {
  isError?: boolean;
  isEmpty?: boolean;
  stageOnly?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function PlaySkeleton({
  isError = false,
  isEmpty = false,
  stageOnly = false,
  errorTitle,
  errorMessage,
  onRetry,
  retryLabel,
}: PlaySkeletonProps) {
  if (isError || isEmpty) {
    const isAlert = isError && !isEmpty;
    const title = errorTitle || (isEmpty ? 'All Caught Up' : 'Lessons Could Not Be Loaded');
    const desc =
      errorMessage ||
      (isEmpty
        ? "You've caught up with this channel. Explore another channel or head back home."
        : 'We encountered an issue fetching your feed items. Please check your connection and try reloading.');
    const defaultRetryText = isEmpty ? 'Refresh Channel' : 'Reload Lessons';

    return (
      <div className={stageOnly ? styles.stageOnlyContainer : styles.skeletonContainer}>
        <div
          className={styles.errorContainer}
          role={isAlert ? 'alert' : 'status'}
          aria-live="polite"
        >
          {isEmpty ? (
            <CheckCircle2 size={40} color="#818CF8" style={{ marginBottom: 16 }} />
          ) : (
            <AlertCircle size={40} color="#EF4444" style={{ marginBottom: 16 }} />
          )}
          <h2 className={styles.errorTitle}>{title}</h2>
          <p className={styles.errorDesc}>{desc}</p>
          <div className={styles.actionButtons}>
            {onRetry && (
              <button type="button" className={styles.retryBtn} onClick={onRetry}>
                <RefreshCw size={14} style={{ marginRight: 6, display: 'inline' }} />
                {retryLabel || defaultRetryText}
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

  if (stageOnly) {
    return (
      <div
        className={styles.stageOnlyContainer}
        role="status"
        aria-label="Loading lessons"
      >
        <div className={styles.stageSpinner} />
      </div>
    );
  }

  return (
    <div className={styles.skeletonContainer} role="status" aria-label="Loading lessons">
      <div className={styles.stageSpinner} />
    </div>
  );
}

export { PlaySkeleton as PlayStageNotice };

