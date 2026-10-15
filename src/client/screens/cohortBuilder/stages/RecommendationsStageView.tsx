'use client';

import React from 'react';
import { Compass, ArrowRight, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import { RecommendationResults } from '@/src/client/screens/cohortCreation/components/RecommendationResults';
import { RecommendationPending } from '@/src/client/screens/cohortCreation/components/RecommendationPending';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import styles from '@/src/client/screens/cohortCreation/components/RecommendationResults.module.css';
import type { useCreation } from '@/src/client/screens/cohortCreation/hooks/useCreation';
import type { EntityRef } from 'interaction-builder/core';

export interface RecommendationsStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

function toValidUuid(value?: string): string {
  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  return '00000000-0000-0000-0000-000000000000';
}

function mapToRecommendationResult(
  recommendations: CohortWorkspace['recommendations'],
  intent: string
): RecommendationResult {
  const rawItems = recommendations?.items ?? [];
  const items = rawItems.map((item, index) => {
    return {
      cohort: {
        cohortId: item.id,
        title: item.label,
        description: item.description ?? '',
        coverImage: item.coverImage ?? null,
        creatorName: item.creatorName ?? null,
        difficulty: (item.difficulty ?? 'BEGINNER') as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
        categories: item.categories ?? [],
        estimatedCompletionTime: item.estimatedCompletionTime ?? null,
        memberCount: item.memberCount ?? 0,
        lessonCount: item.lessonCount ?? 0,
        visibility: 'PUBLIC' as const,
        isPublished: true as const,
      },
      reason: item.reason ?? '',
      rank: index + 1,
      isBestMatch: item.isBestMatch ?? index === 0,
    };
  });

  return {
    requestId: toValidUuid(recommendations?.requestId),
    inputRevision: recommendations?.generation ?? 0,
    intent: {
      id: toValidUuid(recommendations?.resultId),
      rawQuery: intent || 'Learning Intent',
      revision: recommendations?.generation ?? 0,
      topic: {
        value: intent || 'Your Learning Journey',
        origin: 'user',
        acceptedRevision: recommendations?.generation ?? 0,
      },
      outcomes: {
        value: [],
        origin: 'user',
        acceptedRevision: recommendations?.generation ?? 0,
      },
      level: null,
      language: null,
      searchTerms: [],
      uncertainties: [],
    },
    items,
    mode: 'ai',
  };
}

export function RecommendationsStageView({
  workspace,
  dispatchAction,
}: RecommendationsStageViewProps) {
  const recommendations = workspace.recommendations;
  const status = recommendations?.status;

  const handleCreateOwn = () => {
    void dispatchAction({ type: 'create_own_cohort' });
  };

  // 1. Ready state: render RecommendationResults
  if (status === 'ready') {
    const result = mapToRecommendationResult(recommendations, workspace.intent);
    return (
      <RecommendationResults
        result={result}
        onCreateOwn={handleCreateOwn}
      />
    );
  }

  // 2. Failed state: render designed empty state with retry option and 'Create my own cohort'
  if (status === 'failed') {
    return (
      <section aria-label="Cohort recommendations" className={styles.results}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Make room for your curiosity</p>
          <h1>
            {workspace.intent || 'Your Learning Journey'}
            <InkUnderline className={styles.underline} />
          </h1>
          <p className={styles.subtitle}>
            We couldn’t load public cohort recommendations right now.
          </p>
        </header>

        <div className={styles.empty}>
          <Compass size={32} strokeWidth={1.5} />
          <h2>Unable to load recommendations</h2>
          <p>
            Something went wrong searching for matching cohorts. You can try searching again, or start creating your own cohort from this intent.
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              void dispatchAction({ type: 'set_intent', intent: workspace.intent });
            }}
          >
            <RotateCcw size={16} aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            Retry recommendation search
          </button>
        </div>

        <footer className={styles.create}>
          <span className={styles.compass}>
            <Compass size={26} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div>
            <strong>Ready to build?</strong>
            <p>Create your own cohort and I’ll help you build it.</p>
          </div>
          <button type="button" onClick={handleCreateOwn}>
            Create my own cohort <ArrowRight size={18} aria-hidden="true" />
          </button>
        </footer>
      </section>
    );
  }

  // 3. Queued or running state (or initial state): render RecommendationPending and 'Create my own cohort'
  const creationAdapter = {
    snapshot: {
      status: 'running' as const,
      error: null,
      query: workspace.intent,
    },
    cancel: handleCreateOwn,
    runQuery: () => {},
    queryPending: false,
  } as unknown as ReturnType<typeof useCreation>;

  return (
    <div className={styles.results}>
      <RecommendationPending
        creation={creationAdapter}
        initialQuery={workspace.intent}
      />
      <footer className={styles.create} style={{ marginTop: 24 }}>
        <span className={styles.compass}>
          <Compass size={26} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <strong>Want to skip ahead?</strong>
          <p>You can start creating your own cohort right away.</p>
        </div>
        <button type="button" onClick={handleCreateOwn}>
          Create my own cohort <ArrowRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
