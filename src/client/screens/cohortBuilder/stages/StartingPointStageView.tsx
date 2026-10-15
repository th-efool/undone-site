'use client';

import React from 'react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { StartingPoint } from '@/src/client/screens/cohortCreation/components/StartingPoint';
import type { EntityRef } from 'interaction-builder/core';

export interface StartingPointStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function StartingPointStageView({
  workspace,
  dispatchAction,
}: StartingPointStageViewProps) {
  return (
    <StartingPoint
      selected={workspace.journey?.branch ?? null}
      onSelect={choice => {
        void dispatchAction({ type: 'choose_starting_point', choice });
      }}
      onBack={() => {
        void dispatchAction({ type: 'back_to_recommendations' });
      }}
      disabled={false}
      compact={false}
    />
  );
}
