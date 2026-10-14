'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Rocket,
  Lock,
  Globe,
  ArrowRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { validateCohortReadiness } from '@/src/shared/cohort-builder/readiness';
import { useDispatchAction } from '@/src/client/interaction/hooks';
import styles from '../CohortBuilder.module.css';

export interface ReleasePanelProps {
  workspace: CohortWorkspace;
  workspaceId: string;
  onNavigateToDestination?: (url: string) => void;
}

export function ReleasePanel({
  workspace,
  workspaceId,
  onNavigateToDestination,
}: ReleasePanelProps) {
  const dispatchAction = useDispatchAction<CohortAction>();

  const isPubliclyPublished =
    workspace.release?.status === 'released' &&
    workspace.release?.mode === 'public_publish';

  const [selectedMode, setSelectedMode] = useState<'private_activation' | 'public_publish'>(
    isPubliclyPublished ? 'public_publish' : 'private_activation'
  );
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Synchronously compute readiness for current selection
  const readiness = useMemo(
    () => validateCohortReadiness(workspace, selectedMode),
    [workspace, selectedMode]
  );

  const existingReceipt = workspace.release?.status === 'released' ? workspace.release.receipt : null;
  const destinationUrl = existingReceipt?.destinationUrl || (
    workspace.release?.cohortId
      ? workspace.release.mode === 'public_publish'
        ? `/cohort/${workspace.release.cohortId}`
        : `/play?cohort=${workspace.release.cohortId}`
      : null
  );

  const handleModeChange = (mode: 'private_activation' | 'public_publish') => {
    if (isPubliclyPublished && mode === 'private_activation') {
      return; // Cannot downgrade a public cohort
    }
    setSelectedMode(mode);
    setReleaseError(null);
  };

  const handleRelease = async () => {
    if (!readiness.ready || isReleasing) return;
    setIsReleasing(true);
    setReleaseError(null);

    try {
      const response = await fetch(`/api/cohort-builder/workspaces/${workspaceId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.report?.blockers?.length) {
          setReleaseError(`Release blocked: ${data.report.blockers.join('; ')}`);
        } else {
          setReleaseError(data.message || `Release failed (status ${response.status})`);
        }
        setIsReleasing(false);
        return;
      }

      if (data.receipt) {
        // Dispatch local commit_release action to keep local store in sync
        try {
          await dispatchAction({
            type: 'commit_release',
            mode: selectedMode,
            candidateHash: data.receipt.contentHash,
            receipt: data.receipt,
          });
        } catch {
          // Local action dispatch is optimistic/sync; ignore if server already committed
        }

        if (onNavigateToDestination && data.receipt.destinationUrl) {
          onNavigateToDestination(data.receipt.destinationUrl);
        } else if (data.receipt.destinationUrl) {
          window.location.assign(data.receipt.destinationUrl);
        }
      }
    } catch (err) {
      setReleaseError((err as Error).message || 'Network error while attempting release.');
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <section
      id="builder-release"
      className={styles.releaseSection}
      aria-label="Cohort Release and Learner Delivery"
    >
      <div className={styles.releaseHeader}>
        <div className={styles.releaseTitleGroup}>
          <Rocket size={20} className={styles.releaseIcon} />
          <h3>Release & Learner Delivery</h3>
        </div>

        {workspace.release?.status === 'released' ? (
          <span className={styles.badgeReleased} role="status">
            <CheckCircle2 size={13} />
            {workspace.release.mode === 'public_publish' ? 'Published Publicly' : 'Released (Private)'}
          </span>
        ) : readiness.ready ? (
          <span className={styles.badgeReady} role="status">
            <CheckCircle2 size={13} />
            Ready for Release
          </span>
        ) : (
          <span className={styles.badgeBlocked} role="status">
            <AlertCircle size={13} />
            {readiness.blockers.length} Blocker{readiness.blockers.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Mode Selector */}
      <div className={styles.modeSelector} role="radiogroup" aria-label="Release mode">
        <label
          className={`${styles.modeOption} ${selectedMode === 'private_activation' ? styles.modeOptionActive : ''} ${isPubliclyPublished ? styles.modeDisabled : ''}`}
        >
          <input
            type="radio"
            name="releaseMode"
            value="private_activation"
            checked={selectedMode === 'private_activation'}
            disabled={isPubliclyPublished}
            onChange={() => handleModeChange('private_activation')}
          />
          <div className={styles.modeText}>
            <div className={styles.modeLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> Start as Learner (Private)
            </div>
            <div className={styles.modeDescription}>
              Activate this cohort privately in your personal account to test and complete quests immediately.
            </div>
          </div>
        </label>

        <label
          className={`${styles.modeOption} ${selectedMode === 'public_publish' ? styles.modeOptionActive : ''}`}
        >
          <input
            type="radio"
            name="releaseMode"
            value="public_publish"
            checked={selectedMode === 'public_publish'}
            onChange={() => handleModeChange('public_publish')}
          />
          <div className={styles.modeText}>
            <div className={styles.modeLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Globe size={14} /> Publish to Directory (Public)
            </div>
            <div className={styles.modeDescription}>
              Publish publicly to the Undone discovery directory with community features and open enrollment.
            </div>
          </div>
        </label>
      </div>

      {isPubliclyPublished && (
        <p className={styles.releaseSubnote}>
          * This cohort has been published publicly. Downgrading public cohorts to private activation is not permitted.
        </p>
      )}

      {/* Blockers Display */}
      {readiness.blockers.length > 0 && (
        <div className={styles.blockersContainer} role="alert" aria-live="polite">
          <h4 className={styles.blockersTitle}>
            <AlertCircle size={15} />
            Readiness Blockers ({readiness.blockers.length})
          </h4>
          <ul className={styles.blockersList}>
            {readiness.blockers.map((blocker, index) => (
              <li key={index}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings Display */}
      {readiness.warnings.length > 0 && (
        <div className={styles.warningsContainer} role="status">
          <h4 className={styles.warningsTitle}>
            <AlertTriangle size={15} />
            Warnings ({readiness.warnings.length})
          </h4>
          <ul className={styles.warningsList}>
            {readiness.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Notice */}
      {releaseError && (
        <div className={styles.blockersContainer} role="alert">
          <h4 className={styles.blockersTitle}>
            <AlertCircle size={15} />
            Release Error
          </h4>
          <p className={styles.releaseErrorText}>{releaseError}</p>
        </div>
      )}

      {/* Existing Release Receipt Information */}
      {existingReceipt && (
        <div className={styles.receiptCard}>
          <p>
            <strong>Cohort ID:</strong> {existingReceipt.cohortId}
          </p>
          <p>
            <strong>Status:</strong> Released as {existingReceipt.mode === 'public_publish' ? 'Public Cohort' : 'Private Cohort'}
          </p>
          <p>
            <strong>Released At:</strong> {new Date(existingReceipt.releasedAt).toLocaleString()}
          </p>
          <p>
            <strong>Content Hash:</strong> <code>{existingReceipt.contentHash.slice(0, 16)}…</code>
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.releaseActionsBar}>
        <div>
          {destinationUrl && (
            <a
              href={destinationUrl}
              className={styles.destinationBtn}
              target="_self"
              rel="noreferrer"
            >
              Enter Cohort ({selectedMode === 'public_publish' ? 'Public View' : '/play'})
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        <button
          className={styles.releaseBtn}
          disabled={!readiness.ready || isReleasing}
          onClick={() => void handleRelease()}
          aria-label={
            workspace.release?.status === 'released'
              ? 'Update / Re-release Cohort'
              : selectedMode === 'public_publish'
              ? 'Publish Cohort'
              : 'Release & Start Learning'
          }
        >
          {isReleasing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Releasing...
            </>
          ) : workspace.release?.status === 'released' ? (
            <>
              Update / Re-release
              <ArrowRight size={15} />
            </>
          ) : selectedMode === 'public_publish' ? (
            <>
              Publish Cohort
              <Globe size={15} />
            </>
          ) : (
            <>
              Release & Start Learning
              <Rocket size={15} />
            </>
          )}
        </button>
      </div>
    </section>
  );
}
