'use client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { ReadyWorkspace } from './ReadyWorkspace';

export function AllSetReview({ snapshot, onPublish, onReview, onBack, disabled }: {
  snapshot: CreationSnapshot;
  onPublish?: () => Promise<boolean> | void;
  onReview?: () => Promise<boolean> | void;
  onBack?: () => Promise<boolean> | void;
  disabled?: boolean;
}) {
  return (
    <ReadyWorkspace
      snapshot={snapshot}
      disabled={disabled ?? false}
      onActivate={async () => {
        if (onPublish) await onPublish();
        return true;
      }}
      onReview={async () => {
        if (onReview) await onReview();
        return true;
      }}
      onBack={async () => {
        if (onBack) await onBack();
        return true;
      }}
    />
  );
}
