"use client";
import Image from 'next/image';

import { useState } from 'react';
import { Rocket, Check, Copy, ExternalLink, RefreshCw, ArrowLeft } from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './LaunchSuccess.module.css';

export function LaunchSuccess() {
  const { launchState, state, curriculumState, actions } = useWizardContext();
  const [copied, setCopied] = useState(false);
  const result = launchState.publishResult;

  if (!result) return null;

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${result.cohortUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.celebrationIcon}>
        <Rocket size={32} color="#34d399" />
      </div>

      <div>
        <h2 className={styles.title}>Your Cohort is Live! 🎉</h2>
        <p className={styles.subtitle}>
          Congratulations! <strong>{result.cohortTitle}</strong> has been successfully published to the SideQuestHQ network and is ready for learners.
        </p>
      </div>

      <div className={styles.card}>
        <Image fill
          src={result.coverImage || state.draft.coverImage || '/mock/thumbnails/docker.avif'}
          alt={result.cohortTitle}
          className={styles.artwork}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/mock/thumbnails/docker.avif';
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span className={styles.cardTitle}>{result.cohortTitle}</span>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
            <Badge variant="success" size="sm">
              {result.visibility}
            </Badge>
            <Badge variant="brand" size="sm">
              {result.totalHours} · {result.totalLessons} lessons
            </Badge>
            <Badge variant="momentum" size="sm">
              Quality {result.qualityScore}%
            </Badge>
          </div>
        </div>
      </div>

      <div className={styles.actionsGroup}>
        <a href={result.cohortUrl} className={styles.primaryBtn}>
          <ExternalLink size={16} />
          View Cohort Page
        </a>

        <button type="button" onClick={handleCopyLink} className={styles.secondaryBtn}>
          {copied ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
          {copied ? 'Link Copied!' : 'Copy Link'}
        </button>

        <button type="button" onClick={actions.resetLaunch} className={styles.secondaryBtn}>
          <RefreshCw size={16} />
          Continue Editing
        </button>

        <button
          type="button"
          onClick={() => {
            actions.resetLaunch();
            actions.setStep('topic');
          }}
          className={styles.secondaryBtn}
        >
          <ArrowLeft size={16} />
          Create Another Cohort
        </button>
      </div>
    </div>
  );
}
