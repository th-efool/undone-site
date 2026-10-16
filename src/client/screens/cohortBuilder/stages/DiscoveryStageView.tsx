'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ExternalLink, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type {
  CohortAction,
  CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import startingStyles from '@/src/client/screens/cohortCreation/components/StartingPoint.module.css';
import styles from './DiscoveryStageView.module.css';

export interface DiscoveryStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function DiscoveryStageView({
  workspace,
  dispatchAction,
}: DiscoveryStageViewProps) {
  const discovery = workspace.discovery;
  const status = discovery?.status;
  const items = discovery?.items ?? [];

  // Manage candidate selections when results are available
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  useEffect(() => {
    if (discovery?.status === 'ready' && items.length > 0) {
      setSelectedCandidateIds(items.map(i => i.id));
    } else {
      setSelectedCandidateIds([]);
    }
  }, [discovery?.resultId, discovery?.status, items.length]);

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedCandidateIds(items.map(i => i.id));
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds([]);
  };

  const handleAcquire = async () => {
    if (!discovery?.resultId || selectedCandidateIds.length === 0) return;
    await dispatchAction({
      type: 'select_discovery_resources',
      resultId: discovery.resultId,
      candidateIds: selectedCandidateIds,
    });
  };

  return (
    <section aria-label="Find learning material" className={styles.workspace}>
      {/* Top starting point tabs */}
      <nav aria-label="Starting point" className={startingStyles.compact}>
        <button
          type="button"
          onClick={() => void dispatchAction({ type: 'back_to_starting_point' })}
          aria-label="Back to starting point"
        >
          <ArrowLeft size={16} />
        </button>
        {[
          { value: 'have_material' as const, label: 'I already have material' },
          { value: 'find_material' as const, label: 'Find material for me' },
          { value: 'have_goal' as const, label: 'I just have a goal' },
        ].map(choice => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={(workspace.journey?.branch ?? 'find_material') === choice.value}
            onClick={async () => {
              if (workspace.journey?.branch === choice.value) return;
              await dispatchAction({ type: 'back_to_starting_point' });
              await dispatchAction({ type: 'choose_starting_point', choice: choice.value });
            }}
          >
            {choice.label}
          </button>
        ))}
      </nav>

      {/* Editorial Header */}
      <header className={styles.heading}>
        <p className={styles.eyebrow}>FIND LEARNING MATERIAL</p>
        <h1>
          Discover grounded sources for your{' '}
          <span className={styles.underlineSpan}>
            learning intent.<InkUnderline className={styles.underline} />
          </span>
        </h1>
        <p className={styles.subtitle}>
          Search searches for grounded sources using your saved intent. Review observed sources before acquiring their content.
        </p>
      </header>

      {/* Main Content Area based on status */}
      <div className={styles.card}>
        {/* State 1: Initial / Idle / Canceled */}
        {(!discovery || status === 'canceled') && (
          <div>
            <div className={styles.savedGoalBox}>
              <span className={styles.savedGoalLabel}>Saved learning intent</span>
              <p className={styles.savedGoalText}>
                {workspace.intent || 'No intent provided'}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => void dispatchAction({ type: 'start_discovery' })}
                className={styles.primaryBtn}
              >
                Find sources
              </button>
            </div>
          </div>
        )}

        {/* State 2: Queued or Running */}
        {(status === 'queued' || status === 'running') && (
          <div className={styles.loadingBox} role="status">
            <Loader2 size={32} className={styles.spinner} aria-hidden="true" />
            <p className={styles.loadingText}>Searching for grounded sources...</p>
            <button
              type="button"
              onClick={() => void dispatchAction({ type: 'cancel_discovery' })}
              className={styles.cancelBtn}
            >
              Cancel search
            </button>
          </div>
        )}

        {/* State 3: Failed */}
        {status === 'failed' && (
          <div className={styles.failedBox} role="alert">
            <AlertCircle size={24} color="#e53e3e" aria-hidden="true" />
            <p className={styles.failedText}>
              Source discovery could not be completed. Your goal remains saved.
            </p>
            <button
              type="button"
              onClick={() => void dispatchAction({ type: 'start_discovery' })}
              className={styles.primaryBtn}
            >
              <RefreshCw size={15} aria-hidden="true" /> Retry search
            </button>
          </div>
        )}

        {/* State 4: Ready */}
        {status === 'ready' && (
          <div>
            {items.length === 0 ? (
              /* Honest empty state */
              <div className={styles.emptyBox}>
                <p className={styles.emptyText}>
                  No usable public sources were observed for this intent. Search again or choose &apos;I already have material&apos; to provide your own.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    type="button"
                    onClick={() => void dispatchAction({ type: 'start_discovery' })}
                    className={styles.primaryBtn}
                  >
                    Search again
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await dispatchAction({ type: 'back_to_starting_point' });
                      await dispatchAction({ type: 'choose_starting_point', choice: 'have_material' });
                    }}
                    className={styles.secondaryBtn}
                  >
                    Provide my own material
                  </button>
                </div>
              </div>
            ) : (
              /* Candidate Items List */
              <div>
                <div className={styles.resultsHeader}>
                  <span className={styles.resultsCount}>
                    {selectedCandidateIds.length} of {items.length} selected
                  </span>
                  <div className={styles.selectionHelpers}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className={styles.linkBtn}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className={styles.linkBtn}
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                <div className={styles.candidateList} role="list">
                  {items.map(item => {
                    const isSelected = selectedCandidateIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        role="listitem"
                        className={styles.candidateRow}
                        data-selected={isSelected}
                        onClick={() => handleToggleCandidate(item.id)}
                      >
                        <input
                          type="checkbox"
                          id={`candidate-${item.id}`}
                          aria-label={item.label}
                          checked={isSelected}
                          onChange={() => handleToggleCandidate(item.id)}
                          onClick={e => e.stopPropagation()}
                          className={styles.candidateCheckbox}
                        />
                        <div className={styles.candidateContent}>
                          <label
                            htmlFor={`candidate-${item.id}`}
                            className={styles.candidateLabel}
                            onClick={e => e.stopPropagation()}
                          >
                            {item.label}
                          </label>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.candidateUrl}
                            onClick={e => e.stopPropagation()}
                          >
                            {item.url} <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.actionsFooter}>
                  <button
                    type="button"
                    disabled={selectedCandidateIds.length === 0 || !discovery?.resultId}
                    onClick={handleAcquire}
                    className={styles.primaryBtn}
                  >
                    Acquire selected sources ({selectedCandidateIds.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
