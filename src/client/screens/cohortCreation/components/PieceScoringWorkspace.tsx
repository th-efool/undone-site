'use client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { AnalysisWorkspace } from './AnalysisWorkspace';

export function PieceScoringWorkspace({ snapshot, onContinue }: { snapshot: CreationSnapshot; onContinue?: () => void }) {
  return <AnalysisWorkspace snapshot={snapshot} onContinue={onContinue} />;
}
