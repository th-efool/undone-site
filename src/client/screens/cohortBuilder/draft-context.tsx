'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CohortWorkspace, CohortLesson, CohortSource } from '@/src/shared/cohort-builder/contracts';

export type BuilderStage =
  | 'intake'
  | 'understanding'
  | 'chunking'
  | 'analysis'
  | 'assembly'
  | 'curriculum'
  | 'review';

export interface SourceDraft {
  label: string;
  text: string;
  editingSourceId: string | null;
  editingSourceVersion: number | null;
  baseLabel: string;
  baseText: string;
  isDirty: boolean;
  conflictDetected: boolean;
  remoteDeleted: boolean;
}

export interface OverviewDraft {
  isOpen: boolean;
  intent: string;
  audience: string;
  dailyMinutes: number;
  baseIntent: string;
  baseAudience: string;
  baseDailyMinutes: number;
  isDirty: boolean;
  conflictDetected: boolean;
}

export interface LessonDraft {
  isOpen: boolean;
  lessonId: string | null;
  lessonVersion: number | null;
  title: string;
  objective: string;
  baseTitle: string;
  baseObjective: string;
  isDirty: boolean;
  conflictDetected: boolean;
  remoteDeleted: boolean;
}

export interface NewLessonDraft {
  isOpen: boolean;
  title: string;
  objective: string;
  isDirty: boolean;
}

export interface ExternalDraft {
  webUrl: string;
  youtubeUrl: string;
  githubUrl: string;
  selectedScope: string;
  customPages: string;
}

export interface InspectionDraft {
  chunkingSelectedSourceId: string | null;
  chunkingExpandedChunkId: string | null;
  analysisSelectedSourceId: string | null;
  analysisExpandedChunkId: string | null;
}

export interface WorkspaceDraftBucket {
  sourceDraft: SourceDraft;
  overviewDraft: OverviewDraft;
  lessonDraft: LessonDraft;
  newLessonDraft: NewLessonDraft;
  externalDraft: ExternalDraft;
  inspection: InspectionDraft;
  editingStage: BuilderStage | null;
}

export interface CohortDraftContextValue {
  workspaceKey: string;
  sourceDraft: SourceDraft;
  overviewDraft: OverviewDraft;
  lessonDraft: LessonDraft;
  newLessonDraft: NewLessonDraft;
  externalDraft: ExternalDraft;
  inspection: InspectionDraft;
  editingStage: BuilderStage | null;

  // Actions and setters
  updateSourceDraft: (updates: Partial<SourceDraft>, stage?: BuilderStage) => void;
  openEditSource: (source: CohortSource, stage?: BuilderStage) => void;
  clearSourceDraft: () => void;
  clearSourceDraftIfUnchanged: (submitted: { label: string; text: string }) => boolean;

  openOverview: (workspace: CohortWorkspace, stage?: BuilderStage) => void;
  updateOverviewDraft: (updates: Partial<OverviewDraft>) => void;
  closeOverview: () => void;
  closeOverviewIfUnchanged: (submitted: { intent: string; audience: string; dailyMinutes: number }) => boolean;

  openEditLesson: (lesson: CohortLesson, stage?: BuilderStage) => void;
  updateLessonDraft: (updates: Partial<LessonDraft>) => void;
  closeEditLesson: () => void;
  closeEditLessonIfUnchanged: (submitted: { title: string; objective: string }) => boolean;

  openAddLesson: (stage?: BuilderStage) => void;
  updateNewLessonDraft: (updates: Partial<NewLessonDraft>) => void;
  closeAddLesson: () => void;
  closeAddLessonIfUnchanged: (submitted: { title: string; objective: string }) => boolean;

  updateExternalDraft: (updates: Partial<ExternalDraft>) => void;
  setInspectionState: (updates: Partial<InspectionDraft>) => void;
  setEditingStage: (stage: BuilderStage | null) => void;

  isAnyDirtyOrOpen: () => boolean;
}

export function createInitialBucket(): WorkspaceDraftBucket {
  return {
    sourceDraft: {
      label: '',
      text: '',
      editingSourceId: null,
      editingSourceVersion: null,
      baseLabel: '',
      baseText: '',
      isDirty: false,
      conflictDetected: false,
      remoteDeleted: false,
    },
    overviewDraft: {
      isOpen: false,
      intent: '',
      audience: '',
      dailyMinutes: 20,
      baseIntent: '',
      baseAudience: '',
      baseDailyMinutes: 20,
      isDirty: false,
      conflictDetected: false,
    },
    lessonDraft: {
      isOpen: false,
      lessonId: null,
      lessonVersion: null,
      title: '',
      objective: '',
      baseTitle: '',
      baseObjective: '',
      isDirty: false,
      conflictDetected: false,
      remoteDeleted: false,
    },
    newLessonDraft: {
      isOpen: false,
      title: '',
      objective: '',
      isDirty: false,
    },
    externalDraft: {
      webUrl: '',
      youtubeUrl: '',
      githubUrl: '',
      selectedScope: '',
      customPages: '',
    },
    inspection: {
      chunkingSelectedSourceId: null,
      chunkingExpandedChunkId: null,
      analysisSelectedSourceId: null,
      analysisExpandedChunkId: null,
    },
    editingStage: null,
  };
}

const draftStore = new Map<string, WorkspaceDraftBucket>();

export function getWorkspaceKey(workspaceId: string, ownerId?: string): string {
  return `${ownerId ?? ''}:${workspaceId}`;
}

export function clearWorkspaceDrafts(workspaceId: string, ownerId?: string) {
  draftStore.delete(getWorkspaceKey(workspaceId, ownerId));
}

export function clearAllDraftsForTesting() {
  draftStore.clear();
}

const CohortDraftContext = createContext<CohortDraftContextValue | null>(null);

function RealCohortDraftProvider({
  workspaceId,
  ownerId,
  children,
}: {
  workspaceId: string;
  ownerId?: string;
  children: React.ReactNode;
}) {
  const workspaceKey = getWorkspaceKey(workspaceId, ownerId);

  const getBucket = useCallback((): WorkspaceDraftBucket => {
    let bucket = draftStore.get(workspaceKey);
    if (!bucket) {
      bucket = createInitialBucket();
      draftStore.set(workspaceKey, bucket);
    }
    return bucket;
  }, [workspaceKey]);

  const [bucket, setBucketState] = useState<WorkspaceDraftBucket>(getBucket);

  useEffect(() => {
    setBucketState(getBucket());
  }, [workspaceKey, getBucket]);

  const bucketRef = useRef<WorkspaceDraftBucket>(bucket);
  bucketRef.current = bucket;

  const updateBucket = useCallback(
    (updater: (prev: WorkspaceDraftBucket) => WorkspaceDraftBucket) => {
      setBucketState(prev => {
        const next = updater(prev);
        draftStore.set(workspaceKey, next);
        bucketRef.current = next;
        return next;
      });
    },
    [workspaceKey]
  );

  const updateSourceDraft = useCallback(
    (updates: Partial<SourceDraft>, stage?: BuilderStage) => {
      updateBucket(prev => {
        const nextDraft = { ...prev.sourceDraft, ...updates };
        const baseLabel = updates.baseLabel !== undefined ? updates.baseLabel : prev.sourceDraft.baseLabel;
        const baseText = updates.baseText !== undefined ? updates.baseText : prev.sourceDraft.baseText;
        const isDirty =
          updates.isDirty !== undefined
            ? updates.isDirty
            : nextDraft.label !== baseLabel ||
              nextDraft.text !== baseText ||
              (nextDraft.editingSourceId === null &&
                (nextDraft.label.trim() !== '' || nextDraft.text.trim() !== ''));

        return {
          ...prev,
          sourceDraft: {
            ...nextDraft,
            isDirty,
          },
          editingStage: stage ?? prev.editingStage ?? 'intake',
        };
      });
    },
    [updateBucket]
  );

  const openEditSource = useCallback(
    (source: CohortSource, stage?: BuilderStage) => {
      updateBucket(prev => ({
        ...prev,
        sourceDraft: {
          label: source.label,
          text: source.text,
          editingSourceId: source.id,
          editingSourceVersion: source.version,
          baseLabel: source.label,
          baseText: source.text,
          isDirty: false,
          conflictDetected: false,
          remoteDeleted: false,
        },
        editingStage: stage ?? prev.editingStage ?? 'curriculum',
      }));
    },
    [updateBucket]
  );

  const clearSourceDraft = useCallback(() => {
    updateBucket(prev => ({
      ...prev,
      sourceDraft: {
        label: '',
        text: '',
        editingSourceId: null,
        editingSourceVersion: null,
        baseLabel: '',
        baseText: '',
        isDirty: false,
        conflictDetected: false,
        remoteDeleted: false,
      },
    }));
  }, [updateBucket]);

  const clearSourceDraftIfUnchanged = useCallback(
    (submitted: { label: string; text: string }): boolean => {
      const current = bucketRef.current.sourceDraft;
      if (current.label.trim() === submitted.label.trim() && current.text === submitted.text) {
        clearSourceDraft();
        return true;
      }
      updateBucket(prev => ({
        ...prev,
        sourceDraft: {
          ...prev.sourceDraft,
          editingSourceId: null,
          editingSourceVersion: null,
          baseLabel: '',
          baseText: '',
          isDirty: true,
        },
      }));
      return false;
    },
    [clearSourceDraft, updateBucket]
  );

  const openOverview = useCallback(
    (workspace: CohortWorkspace, stage?: BuilderStage) => {
      updateBucket(prev => ({
        ...prev,
        overviewDraft: {
          isOpen: true,
          intent: workspace.intent,
          audience: workspace.audience,
          dailyMinutes: workspace.dailyMinutes,
          baseIntent: workspace.intent,
          baseAudience: workspace.audience,
          baseDailyMinutes: workspace.dailyMinutes,
          isDirty: false,
          conflictDetected: false,
        },
        editingStage: stage ?? prev.editingStage ?? 'intake',
      }));
    },
    [updateBucket]
  );

  const updateOverviewDraft = useCallback(
    (updates: Partial<OverviewDraft>) => {
      updateBucket(prev => {
        const nextDraft = { ...prev.overviewDraft, ...updates };
        const baseIntent =
          updates.baseIntent !== undefined ? updates.baseIntent : prev.overviewDraft.baseIntent;
        const baseAudience =
          updates.baseAudience !== undefined ? updates.baseAudience : prev.overviewDraft.baseAudience;
        const baseDailyMinutes =
          updates.baseDailyMinutes !== undefined
            ? updates.baseDailyMinutes
            : prev.overviewDraft.baseDailyMinutes;
        const isDirty =
          updates.isDirty !== undefined
            ? updates.isDirty
            : nextDraft.intent !== baseIntent ||
              nextDraft.audience !== baseAudience ||
              nextDraft.dailyMinutes !== baseDailyMinutes;

        return {
          ...prev,
          overviewDraft: {
            ...nextDraft,
            isDirty,
          },
          editingStage: prev.editingStage ?? 'intake',
        };
      });
    },
    [updateBucket]
  );

  const closeOverview = useCallback(() => {
    updateBucket(prev => ({
      ...prev,
      overviewDraft: {
        ...prev.overviewDraft,
        isOpen: false,
        isDirty: false,
        conflictDetected: false,
      },
    }));
  }, [updateBucket]);

  const closeOverviewIfUnchanged = useCallback(
    (submitted: { intent: string; audience: string; dailyMinutes: number }): boolean => {
      const current = bucketRef.current.overviewDraft;
      if (
        current.intent === submitted.intent &&
        current.audience === submitted.audience &&
        current.dailyMinutes === submitted.dailyMinutes
      ) {
        closeOverview();
        return true;
      }
      updateBucket(prev => ({
        ...prev,
        overviewDraft: {
          ...prev.overviewDraft,
          isDirty: true,
        },
      }));
      return false;
    },
    [closeOverview, updateBucket]
  );

  const openEditLesson = useCallback(
    (lesson: CohortLesson, stage?: BuilderStage) => {
      updateBucket(prev => ({
        ...prev,
        lessonDraft: {
          isOpen: true,
          lessonId: lesson.id,
          lessonVersion: lesson.version,
          title: lesson.title,
          objective: lesson.objective,
          baseTitle: lesson.title,
          baseObjective: lesson.objective,
          isDirty: false,
          conflictDetected: false,
          remoteDeleted: false,
        },
        editingStage: stage ?? prev.editingStage ?? 'curriculum',
      }));
    },
    [updateBucket]
  );

  const updateLessonDraft = useCallback(
    (updates: Partial<LessonDraft>) => {
      updateBucket(prev => {
        const nextDraft = { ...prev.lessonDraft, ...updates };
        const baseTitle = updates.baseTitle !== undefined ? updates.baseTitle : prev.lessonDraft.baseTitle;
        const baseObjective =
          updates.baseObjective !== undefined ? updates.baseObjective : prev.lessonDraft.baseObjective;
        const isDirty =
          updates.isDirty !== undefined
            ? updates.isDirty
            : nextDraft.title !== baseTitle || nextDraft.objective !== baseObjective;

        return {
          ...prev,
          lessonDraft: {
            ...nextDraft,
            isDirty,
          },
          editingStage: prev.editingStage ?? 'curriculum',
        };
      });
    },
    [updateBucket]
  );

  const closeEditLesson = useCallback(() => {
    updateBucket(prev => ({
      ...prev,
      lessonDraft: {
        isOpen: false,
        lessonId: null,
        lessonVersion: null,
        title: '',
        objective: '',
        baseTitle: '',
        baseObjective: '',
        isDirty: false,
        conflictDetected: false,
        remoteDeleted: false,
      },
    }));
  }, [updateBucket]);

  const closeEditLessonIfUnchanged = useCallback(
    (submitted: { title: string; objective: string }): boolean => {
      const current = bucketRef.current.lessonDraft;
      if (current.title === submitted.title && current.objective === submitted.objective) {
        closeEditLesson();
        return true;
      }
      updateBucket(prev => ({
        ...prev,
        lessonDraft: {
          ...prev.lessonDraft,
          isDirty: true,
        },
      }));
      return false;
    },
    [closeEditLesson, updateBucket]
  );

  const openAddLesson = useCallback(
    (stage?: BuilderStage) => {
      updateBucket(prev => ({
        ...prev,
        newLessonDraft: {
          isOpen: true,
          title: '',
          objective: '',
          isDirty: false,
        },
        editingStage: stage ?? prev.editingStage ?? 'curriculum',
      }));
    },
    [updateBucket]
  );

  const updateNewLessonDraft = useCallback(
    (updates: Partial<NewLessonDraft>) => {
      updateBucket(prev => {
        const nextDraft = { ...prev.newLessonDraft, ...updates };
        const isDirty =
          updates.isDirty !== undefined
            ? updates.isDirty
            : nextDraft.title.trim() !== '' || nextDraft.objective.trim() !== '';

        return {
          ...prev,
          newLessonDraft: {
            ...nextDraft,
            isDirty,
          },
          editingStage: prev.editingStage ?? 'curriculum',
        };
      });
    },
    [updateBucket]
  );

  const closeAddLesson = useCallback(() => {
    updateBucket(prev => ({
      ...prev,
      newLessonDraft: {
        isOpen: false,
        title: '',
        objective: '',
        isDirty: false,
      },
    }));
  }, [updateBucket]);

  const closeAddLessonIfUnchanged = useCallback(
    (submitted: { title: string; objective: string }): boolean => {
      const current = bucketRef.current.newLessonDraft;
      if (
        current.title.trim() === submitted.title.trim() &&
        current.objective.trim() === submitted.objective.trim()
      ) {
        closeAddLesson();
        return true;
      }
      updateBucket(prev => ({
        ...prev,
        newLessonDraft: {
          ...prev.newLessonDraft,
          isDirty: true,
        },
      }));
      return false;
    },
    [closeAddLesson, updateBucket]
  );

  const updateExternalDraft = useCallback(
    (updates: Partial<ExternalDraft>) => {
      updateBucket(prev => ({
        ...prev,
        externalDraft: {
          ...prev.externalDraft,
          ...updates,
        },
      }));
    },
    [updateBucket]
  );

  const setInspectionState = useCallback(
    (updates: Partial<InspectionDraft>) => {
      updateBucket(prev => ({
        ...prev,
        inspection: {
          ...prev.inspection,
          ...updates,
        },
      }));
    },
    [updateBucket]
  );

  const setEditingStage = useCallback(
    (stage: BuilderStage | null) => {
      updateBucket(prev => ({
        ...prev,
        editingStage: stage,
      }));
    },
    [updateBucket]
  );

  const isAnyDirtyOrOpen = useCallback((): boolean => {
    const current = bucketRef.current;
    return (
      current.sourceDraft.isDirty ||
      current.sourceDraft.editingSourceId !== null ||
      current.overviewDraft.isOpen ||
      current.overviewDraft.isDirty ||
      current.lessonDraft.isOpen ||
      current.lessonDraft.isDirty ||
      current.newLessonDraft.isOpen ||
      current.newLessonDraft.isDirty
    );
  }, []);

  const value = useMemo<CohortDraftContextValue>(
    () => ({
      workspaceKey,
      sourceDraft: bucket.sourceDraft,
      overviewDraft: bucket.overviewDraft,
      lessonDraft: bucket.lessonDraft,
      newLessonDraft: bucket.newLessonDraft,
      externalDraft: bucket.externalDraft,
      inspection: bucket.inspection,
      editingStage: bucket.editingStage,

      updateSourceDraft,
      openEditSource,
      clearSourceDraft,
      clearSourceDraftIfUnchanged,

      openOverview,
      updateOverviewDraft,
      closeOverview,
      closeOverviewIfUnchanged,

      openEditLesson,
      updateLessonDraft,
      closeEditLesson,
      closeEditLessonIfUnchanged,

      openAddLesson,
      updateNewLessonDraft,
      closeAddLesson,
      closeAddLessonIfUnchanged,

      updateExternalDraft,
      setInspectionState,
      setEditingStage,

      isAnyDirtyOrOpen,
    }),
    [
      workspaceKey,
      bucket,
      updateSourceDraft,
      openEditSource,
      clearSourceDraft,
      clearSourceDraftIfUnchanged,
      openOverview,
      updateOverviewDraft,
      closeOverview,
      closeOverviewIfUnchanged,
      openEditLesson,
      updateLessonDraft,
      closeEditLesson,
      closeEditLessonIfUnchanged,
      openAddLesson,
      updateNewLessonDraft,
      closeAddLesson,
      closeAddLessonIfUnchanged,
      updateExternalDraft,
      setInspectionState,
      setEditingStage,
      isAnyDirtyOrOpen,
    ]
  );

  return <CohortDraftContext.Provider value={value}>{children}</CohortDraftContext.Provider>;
}

export function CohortDraftProvider({
  workspaceId,
  ownerId,
  children,
}: {
  workspaceId: string;
  ownerId?: string;
  children: React.ReactNode;
}) {
  const existing = useContext(CohortDraftContext);
  const currentKey = getWorkspaceKey(workspaceId, ownerId);

  if (existing && existing.workspaceKey === currentKey) {
    return <>{children}</>;
  }

  return (
    <RealCohortDraftProvider workspaceId={workspaceId} ownerId={ownerId}>
      {children}
    </RealCohortDraftProvider>
  );
}

const defaultFallbackBucket = createInitialBucket();
const defaultFallbackContext: CohortDraftContextValue = {
  workspaceKey: 'default',
  sourceDraft: defaultFallbackBucket.sourceDraft,
  overviewDraft: defaultFallbackBucket.overviewDraft,
  lessonDraft: defaultFallbackBucket.lessonDraft,
  newLessonDraft: defaultFallbackBucket.newLessonDraft,
  externalDraft: defaultFallbackBucket.externalDraft,
  inspection: defaultFallbackBucket.inspection,
  editingStage: null,

  updateSourceDraft: () => {},
  openEditSource: () => {},
  clearSourceDraft: () => {},
  clearSourceDraftIfUnchanged: () => true,

  openOverview: () => {},
  updateOverviewDraft: () => {},
  closeOverview: () => {},
  closeOverviewIfUnchanged: () => true,

  openEditLesson: () => {},
  updateLessonDraft: () => {},
  closeEditLesson: () => {},
  closeEditLessonIfUnchanged: () => true,

  openAddLesson: () => {},
  updateNewLessonDraft: () => {},
  closeAddLesson: () => {},
  closeAddLessonIfUnchanged: () => true,

  updateExternalDraft: () => {},
  setInspectionState: () => {},
  setEditingStage: () => {},

  isAnyDirtyOrOpen: () => false,
};

export function useCohortDrafts(): CohortDraftContextValue {
  const context = useContext(CohortDraftContext);
  return context ?? defaultFallbackContext;
}
