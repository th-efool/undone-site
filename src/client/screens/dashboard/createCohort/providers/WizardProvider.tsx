'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { importService } from '../services/importService';
import { curriculumService } from '../services/curriculumService';
import { bulkOperationsService } from '../services/bulkOperationsService';
import { publishService } from '../services/publishService';
import {
  sanitizeInputString,
  validateUrlSecurity,
  validateCohortDraftSecurity,
} from '../utils/securityValidation';
import { createCohortMockDraft, sourceTypeOptions } from '../mock/createCohort.mock';
import { defaultMockImportedSources } from '../mock/curriculum.mock';
import {
  createCohortStepLabels,
  createCohortStepOrder,
  type CreateCohortDraft,
  type CreateCohortSourceDraft,
  type CreateCohortSourceType,
  type CreateCohortStepId,
  type CreateCohortWizardState,
} from '../models/createCohort';
import type {
  ImportErrorModel,
  ImportFeedItemModel,
  ImportPipelineStageModel,
  ImportSourceJob,
  ImportedSourceModel,
  SourceImportCardModel,
} from '../models/import';
import type {
  CurriculumHistoryState,
  MultiSelectionState,
} from '../models/intelligence';
import type {
  CommunityConfigModel,
  DeviceViewport,
  JourneySettingsModel,
  LearnerPreviewTab,
  OnboardingConfigModel,
  PublishResultModel,
  PublishStage,
} from '../models/launch';
import {
  autoBalanceCurriculum,
  createSeason as createSeasonLocal,
  deleteLesson as deleteLessonLocal,
  deleteSeason as deleteSeasonLocal,
  duplicateLesson as duplicateLessonLocal,
  duplicateSeason as duplicateSeasonLocal,
  generateCurriculum as generateCurriculumLocal,
  mergeSeasons as mergeSeasonsLocal,
  moveLesson as moveLessonLocal,
  moveSeason as moveSeasonLocal,
  rebuildFromPlaylistOrder,
  regenerateChunksForCurriculum,
  splitSeason as splitSeasonLocal,
  updateCurriculumMeta as updateCurriculumMetaLocal,
  updateLesson as updateLessonLocal,
  updateSeason as updateSeasonLocal,
  type CurriculumGenerationError,
  type CurriculumLesson,
  type CurriculumSeason,
  type GeneratedCurriculum,
} from '@/src/shared/curriculum';

interface WizardImportState {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled';
  overallProgress: number;
  currentOperation: string;
  currentSourceLabel: string;
  estimatedRemaining: string;
  liveStatus: string;
  activeSourceId: string | null;
  sourceCards: Record<string, SourceImportCardModel>;
  feed: ImportFeedItemModel[];
  importedSources: ImportedSourceModel[];
  error: ImportErrorModel | null;
}

interface WizardCurriculumState {
  curriculum: GeneratedCurriculum | null;
  status: 'idle' | 'generating' | 'ready' | 'failed';
  error: CurriculumGenerationError | null;
  selectedSeasonId: string | null;
  selectedLessonId: string | null;
  searchQuery: string;
  filterWarningOnly: boolean;
  multiSelection: MultiSelectionState;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  history: CurriculumHistoryState;
}

interface WizardLaunchState {
  onboarding: OnboardingConfigModel;
  community: CommunityConfigModel;
  journeySettings: JourneySettingsModel;
  deviceViewport: DeviceViewport;
  previewTab: LearnerPreviewTab;
  publishStage: PublishStage;
  publishResult: PublishResultModel | null;
  publishError: string | null;
  isWeightsModalOpen: boolean;
}

interface WizardContextValue {
  state: CreateCohortWizardState;
  validation: {
    details: boolean;
    topic: boolean;
    sources: boolean;
    curriculum: boolean;
    identity: boolean;
    launch: boolean;
  };
  importState: WizardImportState;
  curriculumState: WizardCurriculumState;
  launchState: WizardLaunchState;
  actions: {
    setStep: (step: CreateCohortStepId) => void;
    goPrevious: () => void;
    goNext: () => void;
    startImport: () => Promise<void>;
    cancelImport: () => void;
    retryImport: () => Promise<void>;
    updateDraftField: <K extends keyof CreateCohortDraft>(
      key: K,
      value: CreateCohortDraft[K],
    ) => void;
    toggleCategory: (category: string) => void;
    addTag: (tag: string) => void;
    removeTag: (tag: string) => void;
    addRequirement: (value: string) => void;
    updateRequirement: (index: number, value: string) => void;
    removeRequirement: (index: number) => void;
    addLearningOutcome: (value: string) => void;
    updateLearningOutcome: (index: number, value: string) => void;
    removeLearningOutcome: (index: number) => void;
    addSource: (urlInput?: string) => void;
    removeSource: (sourceId: string) => void;
    duplicateSource: (sourceId: string) => void;
    toggleSourceCollapse: (sourceId: string) => void;
    updateSourceField: <K extends keyof CreateCohortSourceDraft>(
      sourceId: string,
      key: K,
      value: CreateCohortSourceDraft[K],
    ) => void;
    moveSource: (sourceId: string, targetId: string) => void;

    // Curriculum actions
    generateCurriculum: () => Promise<void>;
    selectSeason: (seasonId: string | null) => void;
    selectLesson: (lessonId: string | null) => void;
    toggleSeasonCollapse: (seasonId: string) => void;
    toggleLessonCollapse: (seasonId: string, lessonId: string) => void;
    updateCurriculumMeta: (patch: Partial<GeneratedCurriculum>) => void;
    addSeason: (title?: string) => void;
    updateSeason: (seasonId: string, patch: Partial<CurriculumSeason>) => void;
    deleteSeason: (seasonId: string) => void;
    duplicateSeason: (seasonId: string) => void;
    splitSeason: (seasonId: string) => void;
    mergeSeasons: (seasonId: string, targetSeasonId: string) => void;
    moveSeason: (seasonId: string, targetId: string) => void;
    updateLesson: (lessonId: string, patch: Partial<CurriculumLesson>) => void;
    deleteLesson: (lessonId: string) => void;
    duplicateLesson: (lessonId: string) => void;
    moveLesson: (lessonId: string, targetSeasonId: string, targetLessonId?: string) => void;
    autoBalance: () => void;
    regenerateChunks: () => void;
    restorePlaylistOrder: () => void;
    setSearchQuery: (query: string) => void;
    setFilterWarningOnly: (filter: boolean) => void;

    // Prompt 4 additions
    toggleSelectLesson: (lessonId: string, isMulti?: boolean) => void;
    toggleSelectSeason: (seasonId: string, isMulti?: boolean) => void;
    clearMultiSelection: () => void;
    selectAllLessons: () => void;
    undo: () => void;
    redo: () => void;
    autoRenameSeasons: () => void;
    autoRenameLessons: () => void;
    regenerateChunkTitles: () => void;
    normalizeDurations: () => void;
    mergeEmptySeasons: () => void;
    deleteEmptyLessons: () => void;
    bulkTag: (tag: string) => void;
    bulkDifficulty: (difficulty: string) => void;
    bulkXP: (xp: number) => void;
    bulkVisibility: (visibility: string) => void;
    bulkDeleteSelected: () => void;
    expandAllSeasons: () => void;
    collapseAllSeasons: () => void;

    // Prompt 5 Launch actions
    updateOnboarding: (patch: Partial<OnboardingConfigModel>) => void;
    toggleCommunityFeature: (key: keyof CommunityConfigModel) => void;
    updateJourneySettings: (patch: Partial<JourneySettingsModel>) => void;
    setDeviceViewport: (viewport: DeviceViewport) => void;
    setPreviewTab: (tab: LearnerPreviewTab) => void;
    publishCohort: (forcePublishWithWeights?: boolean) => Promise<void>;
    resetLaunch: () => void;
    closeWeightsModal: () => void;
  };
}

const WizardContext = createContext<WizardContextValue | null>(null);

const importStages: ImportPipelineStageModel[] = [
  { id: 'queued', title: 'Queued', description: 'Waiting for import.', status: 'pending', progress: 0 },
  { id: 'validating-url', title: 'Validating URL', description: 'Checking source.', status: 'pending', progress: 0 },
  { id: 'connecting', title: 'Connecting', description: 'Connecting to provider API.', status: 'pending', progress: 0 },
  { id: 'playlist-metadata', title: 'Metadata', description: 'Reading source metadata.', status: 'pending', progress: 0 },
  { id: 'playlist-videos', title: 'Fetching', description: 'Downloading items.', status: 'pending', progress: 0 },
  { id: 'video-details', title: 'Details', description: 'Fetching item details.', status: 'pending', progress: 0 },
  { id: 'durations', title: 'Durations', description: 'Calculating durations.', status: 'pending', progress: 0 },
  { id: 'curriculum', title: 'Curriculum', description: 'Packaging curriculum.', status: 'pending', progress: 0 },
  { id: 'completed', title: 'Completed', description: 'Ready for studio.', status: 'pending', progress: 0 },
];

function createSourceId() {
  return `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneSources(sources: CreateCohortSourceDraft[]) {
  return sources.map((source) => ({ ...source }));
}

function moveItem<T extends { id: string }>(items: T[], sourceId: string, targetId: string) {
  const next = [...items];
  const fromIndex = next.findIndex((item) => item.id === sourceId);
  const toIndex = next.findIndex((item) => item.id === targetId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return next;
  }

  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function validateDetails(draft: CreateCohortDraft) {
  return Boolean(draft.title && draft.title.trim().length > 0);
}

function validateTopic(draft: CreateCohortDraft) {
  return Boolean(
    draft.primaryTopic &&
    draft.primaryTopic.trim().length > 0 &&
    draft.categories &&
    draft.categories.length > 0 &&
    draft.estimatedCompletionTime &&
    draft.estimatedCompletionTime.trim().length > 0
  );
}

function validateSources(draft: CreateCohortDraft) {
  return draft.sources.length > 0 && draft.sources.every((source) => source.type && source.url.trim());
}

function insertUnique(values: string[], value: string) {
  const normalized = value.trim();
  if (!normalized || values.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    return values;
  }
  return [...values, normalized];
}

function createInitialCard(source: CreateCohortSourceDraft): SourceImportCardModel {
  return {
    sourceId: source.id,
    sourceType: source.type,
    title: source.title || source.type,
    url: source.url,
    status: 'queued',
    progress: 0,
    currentOperation: 'Queued',
    estimatedRemaining: '--',
    liveStatus: 'Waiting to import',
    stages: importStages,
    feed: [],
    importedSource: null,
    error: null,
  };
}

function normalizeFeed(title: string, detail: string, tone: ImportFeedItemModel['tone']) {
  return {
    id: `feed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    detail,
    tone,
    timestamp: new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }),
  } satisfies ImportFeedItemModel;
}

function calculateOverallProgress(cards: Record<string, SourceImportCardModel>) {
  const values = Object.values(cards);
  if (!values.length) return 0;

  const total = values.reduce((sum, card) => {
    if (card.status === 'completed' || card.status === 'pending-provider') return sum + 100;
    if (card.status === 'failed' || card.status === 'canceled') return sum + card.progress;
    return sum + card.progress;
  }, 0);

  return Math.min(100, Math.round(total / values.length));
}

function createImportState(sources: CreateCohortSourceDraft[]): WizardImportState {
  const sourceCards = Object.fromEntries(
    sources.map((source) => [source.id, createInitialCard(source)]),
  );

  return {
    status: 'idle',
    overallProgress: 0,
    currentOperation: 'Ready to import',
    currentSourceLabel: '',
    estimatedRemaining: '--',
    liveStatus: 'No import running',
    activeSourceId: null,
    sourceCards,
    feed: [],
    importedSources: [],
    error: null,
  };
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(
      urlStr.startsWith('http://') || urlStr.startsWith('https://')
        ? urlStr
        : `https://${urlStr}`,
    );
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function parseSourceUrlInput(urlInput?: string): {
  type: CreateCohortSourceType;
  url: string;
  title: string;
  domain: string;
  thumbnailUrl?: string;
  collapsed: boolean;
} {
  const rawUrl = typeof urlInput === 'string' ? urlInput.trim() : '';
  if (!rawUrl) {
    return {
      type: sourceTypeOptions[0] ?? 'YouTube Playlist',
      url: '',
      title: '',
      domain: '',
      thumbnailUrl: undefined,
      collapsed: false,
    };
  }

  const domain = extractDomain(rawUrl);
  let type: CreateCohortSourceType = 'Website';
  let thumbnailUrl: string | undefined = undefined;

  const videoIdMatch = rawUrl.match(
    /(?:v=|\/embed\/|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  if (rawUrl.includes('list=')) {
    type = 'YouTube Playlist';
    thumbnailUrl = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=400&auto=format&fit=crop';
  } else if (rawUrl.includes('v=') || rawUrl.includes('youtu.be/') || videoId) {
    type = 'YouTube Video';
    if (videoId) {
      thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } else if (rawUrl.toLowerCase().includes('github.com') || domain === 'github.com') {
    type = 'GitHub Repository';
  } else if (rawUrl.toLowerCase().includes('notion.so') || rawUrl.toLowerCase().includes('notion.site') || rawUrl.toLowerCase().includes('app.notion.com')) {
    type = 'Notion Workspace';
  } else if (rawUrl.toLowerCase().endsWith('.pdf') || rawUrl.toLowerCase().includes('.pdf?')) {
    type = 'PDF';
  } else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    type = 'Custom Link';
  } else {
    type = 'Website';
  }

  const effectiveDomain = type === 'GitHub Repository' ? 'github.com' : type === 'Notion Workspace' ? 'notion.so' : domain;
  const title = effectiveDomain || rawUrl;

  return {
    type,
    url: rawUrl,
    title,
    domain: effectiveDomain,
    thumbnailUrl,
    collapsed: false,
  };
}

export function WizardProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<CreateCohortWizardState>({
    currentStep: 'topic',
    draft: createCohortMockDraft,
  });
  const [importState, setImportState] = useState<WizardImportState>(() =>
    createImportState(createCohortMockDraft.sources),
  );
  const [curriculumState, setCurriculumState] = useState<WizardCurriculumState>({
    curriculum: null,
    status: 'idle',
    error: null,
    selectedSeasonId: null,
    selectedLessonId: null,
    searchQuery: '',
    filterWarningOnly: false,
    multiSelection: { selectedLessonIds: [], selectedSeasonIds: [] },
    saveStatus: 'saved',
    history: { canUndo: false, canRedo: false, historyLength: 0 },
  });
  const [launchState, setLaunchState] = useState<WizardLaunchState>({
    onboarding: {
      welcomeMessage: '',
      journeyIntroduction: '',
      recommendedDailyGoal: '30 mins/day',
      suggestedWeeklyCommitment: '3.5 hours/week',
      completionMotivation: '',
      communityGuidelines: [
        'Be respectful and constructive',
        'Share real progress, not just theory',
        'Help fellow learners when stuck',
      ],
      pinnedResources: [],
    },
    community: {
      discussionFeed: true,
      assignments: true,
      projects: true,
      publicNotes: true,
      archives: true,
      hallOfFame: true,
      events: true,
      leaderboards: true,
      communityChat: true,
      qAndA: true,
    },
    journeySettings: {
      visibility: 'Public',
      language: 'English',
      difficulty: 'Intermediate',
      targetAudience: '',
      estimatedWeeklyCommitment: '3-4 hours/week',
      categories: [],
      topics: [],
      keywords: [],
    },
    deviceViewport: 'desktop',
    previewTab: 'overview',
    publishStage: 'idle',
    publishResult: null,
    publishError: null,
    isWeightsModalOpen: false,
  });

  const historyStackRef = useRef<GeneratedCurriculum[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const stateRef = useRef(state);
  const importStateRef = useRef(importState);
  const curriculumStateRef = useRef(curriculumState);
  const launchStateRef = useRef(launchState);
  const currentJobRef = useRef<ImportSourceJob | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    importStateRef.current = importState;
  }, [importState]);

  useEffect(() => {
    curriculumStateRef.current = curriculumState;
  }, [curriculumState]);

  useEffect(() => {
    launchStateRef.current = launchState;
  }, [launchState]);

  // Helper to commit curriculum updates to history stack
  const updateCurriculumWithHistory = useCallback((nextCurriculum: GeneratedCurriculum) => {
    const stack = historyStackRef.current;
    const currentIndex = historyIndexRef.current;

    const newStack = [...stack.slice(0, currentIndex + 1), nextCurriculum];
    historyStackRef.current = newStack;
    historyIndexRef.current = newStack.length - 1;

    setCurriculumState((current) => ({
      ...current,
      curriculum: nextCurriculum,
      saveStatus: 'saved',
      history: {
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < newStack.length - 1,
        historyLength: newStack.length,
      },
    }));
  }, []);

  const validation = useMemo(
    () => ({
      details: true,
      topic: validateTopic(state.draft),
      sources: validateSources(state.draft),
      curriculum: Boolean(
        curriculumState.curriculum && curriculumState.curriculum.totalLessons > 0,
      ),
      identity: Boolean(state.draft.title && state.draft.title.trim().length > 0),
      launch: Boolean(
        curriculumState.curriculum &&
          curriculumState.curriculum.totalLessons > 0 &&
          state.draft.title.trim() &&
          state.draft.description.trim(),
      ),
    }),
    [state.draft, curriculumState.curriculum],
  );

  const updateSourceCard = useCallback(
    (sourceId: string, updater: (card: SourceImportCardModel) => SourceImportCardModel) => {
      setImportState((current) => {
        const card = current.sourceCards[sourceId];
        if (!card) return current;

        const nextCards = {
          ...current.sourceCards,
          [sourceId]: updater(card),
        };

        return {
          ...current,
          sourceCards: nextCards,
          overallProgress: calculateOverallProgress(nextCards),
        };
      });
    },
    [],
  );

  const appendFeed = useCallback((item: ImportFeedItemModel) => {
    setImportState((current) => ({
      ...current,
      feed: [item, ...current.feed].slice(0, 12),
    }));
  }, []);

  const setActiveSourceState = useCallback(
    (
      sourceId: string,
      patchOrUpdater:
        | Partial<SourceImportCardModel>
        | ((card: SourceImportCardModel) => SourceImportCardModel),
    ) => {
      updateSourceCard(sourceId, (card) => {
        if (typeof patchOrUpdater === 'function') {
          return patchOrUpdater(card);
        }

        return {
          ...card,
          ...patchOrUpdater,
        };
      });
    },
    [updateSourceCard],
  );

  // Generation action
  const generateCurriculumAction = useCallback(async (overrideSources?: ImportedSourceModel[]) => {
    setCurriculumState((current) => ({
      ...current,
      status: 'generating',
      error: null,
    }));

    const cardSources = Object.values(importStateRef.current.sourceCards)
      .map((card) => card.importedSource)
      .filter((s): s is ImportedSourceModel => Boolean(s && s.lessons && s.lessons.length > 0));

    const candidateSources =
      overrideSources && overrideSources.length > 0
        ? overrideSources
        : importStateRef.current.importedSources.length > 0
          ? importStateRef.current.importedSources
          : cardSources;

    const sources =
      candidateSources.length > 0
        ? candidateSources
        : (() => {
            throw new Error('No curriculum sources available');
          })();

    try {
      const generated = await curriculumService.generateCurriculum({
        title: stateRef.current.draft.title || sources[0]?.title || 'Curriculum',
        description: stateRef.current.draft.description || sources[0]?.description || 'Auto-generated curriculum',
        importedSources: sources,
      });

      historyStackRef.current = [generated];
      historyIndexRef.current = 0;

      setCurriculumState((current) => ({
        ...current,
        curriculum: generated,
        status: 'ready',
        error: null,
        selectedSeasonId: generated.seasons[0]?.id ?? null,
        selectedLessonId: generated.seasons[0]?.lessons[0]?.id ?? null,
        history: { canUndo: false, canRedo: false, historyLength: 1 },
      }));
    } catch {
      try {
        const localGenerated = generateCurriculumLocal({
          title: stateRef.current.draft.title || sources[0]?.title || 'Curriculum',
          description: stateRef.current.draft.description || sources[0]?.description || 'Auto-generated curriculum',
          importedSources: sources,
        });

        historyStackRef.current = [localGenerated];
        historyIndexRef.current = 0;

        setCurriculumState((current) => ({
          ...current,
          curriculum: localGenerated,
          status: 'ready',
          error: null,
          selectedSeasonId: localGenerated.seasons[0]?.id ?? null,
          selectedLessonId: localGenerated.seasons[0]?.lessons[0]?.id ?? null,
          history: { canUndo: false, canRedo: false, historyLength: 1 },
        }));
      } catch (fallbackErr) {
        const message = fallbackErr instanceof Error ? fallbackErr.message : 'Curriculum generation failed';
        setCurriculumState((current) => ({
          ...current,
          status: 'failed',
          error: {
            code: 'generation_failed',
            title: 'Generation Failed',
            message,
            retryable: true,
          },
        }));
      }
    }
  }, []);

  const setStep = useCallback(
    (step: CreateCohortStepId) => {
      setState((current) => {
        const targetIndex = createCohortStepOrder.indexOf(step);
        if (targetIndex < 0 || targetIndex > 4) {
          return current;
        }

        if (step === 'curriculum') {
          if (!curriculumStateRef.current.curriculum && curriculumStateRef.current.status !== 'generating') {
            setTimeout(() => {
              void generateCurriculumAction();
            }, 0);
          }
          return { ...current, currentStep: step };
        }

        if (step === 'publish') {
          if (!curriculumStateRef.current.curriculum) {
            setTimeout(() => {
              void generateCurriculumAction();
            }, 0);
          }
          return { ...current, currentStep: step };
        }

        return { ...current, currentStep: step };
      });
    },
    [generateCurriculumAction],
  );

  const goPrevious = useCallback(() => {
    setState((current) => {
      if (current.currentStep === 'sources') {
        return { ...current, currentStep: 'topic' };
      }
      if (current.currentStep === 'curriculum') {
        return { ...current, currentStep: 'sources' };
      }
      if (current.currentStep === 'identity') {
        return { ...current, currentStep: 'curriculum' };
      }
      if (current.currentStep === 'publish') {
        return { ...current, currentStep: 'identity' };
      }
      return current;
    });
  }, []);

  const updateDraftField = useCallback(
    <K extends keyof CreateCohortDraft>(key: K, value: CreateCohortDraft[K]) => {
      let sanitizedValue: any = value;
      if (typeof value === 'string') {
        if (key === 'title') {
          sanitizedValue = sanitizeInputString(value, 100);
        } else if (key === 'subtitle') {
          sanitizedValue = sanitizeInputString(value, 200);
        } else if (key === 'description') {
          sanitizedValue = sanitizeInputString(value, 2000);
        } else if (key === 'primaryTopic') {
          sanitizedValue = sanitizeInputString(value, 100);
        } else {
          sanitizedValue = sanitizeInputString(value);
        }
      }

      setState((current) => ({
        ...current,
        draft: {
          ...current.draft,
          [key]: sanitizedValue,
        },
      }));
    },
    [],
  );

  const toggleCategory = useCallback((category: string) => {
    setState((current) => {
      const selected = current.draft.categories.includes(category)
        ? current.draft.categories.filter((item) => item !== category)
        : [...current.draft.categories, category];

      return {
        ...current,
        draft: {
          ...current.draft,
          categories: selected,
        },
      };
    });
  }, []);

  const addTag = useCallback((tag: string) => {
    const sanitized = sanitizeInputString(tag, 30);
    if (!sanitized) return;

    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        tags: insertUnique(current.draft.tags, sanitized),
      },
    }));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        tags: current.draft.tags.filter((item) => item !== tag),
      },
    }));
  }, []);

  const addRequirement = useCallback((value: string) => {
    const next = sanitizeInputString(value, 200);
    if (!next) return;

    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        requirements: [...current.draft.requirements, next],
      },
    }));
  }, []);

  const updateRequirement = useCallback((index: number, value: string) => {
    const sanitized = sanitizeInputString(value, 200);
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        requirements: current.draft.requirements.map((item, currentIndex) =>
          currentIndex === index ? sanitized : item,
        ),
      },
    }));
  }, []);

  const removeRequirement = useCallback((index: number) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        requirements: current.draft.requirements.filter((_, currentIndex) => currentIndex !== index),
      },
    }));
  }, []);

  const addLearningOutcome = useCallback((value: string) => {
    const next = sanitizeInputString(value, 200);
    if (!next) return;

    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        learningOutcomes: [...current.draft.learningOutcomes, next],
      },
    }));
  }, []);

  const updateLearningOutcome = useCallback((index: number, value: string) => {
    const sanitized = sanitizeInputString(value, 200);
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        learningOutcomes: current.draft.learningOutcomes.map((item, currentIndex) =>
          currentIndex === index ? sanitized : item,
        ),
      },
    }));
  }, []);

  const removeLearningOutcome = useCallback((index: number) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        learningOutcomes: current.draft.learningOutcomes.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      },
    }));
  }, []);

  const addSource = useCallback((urlInput?: string) => {
    let effectiveUrl = urlInput;
    if (urlInput && urlInput.trim()) {
      const urlVal = validateUrlSecurity(urlInput);
      if (!urlVal.valid) {
        return;
      }
      effectiveUrl = urlVal.sanitizedUrl;
    }
    const parsed = parseSourceUrlInput(effectiveUrl);
    const newSourceId = createSourceId();

    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sources: [
          {
            id: newSourceId,
            type: parsed.type,
            title: parsed.title || 'Loading metadata...',
            url: parsed.url,
            collapsed: false,
            thumbnailUrl: parsed.thumbnailUrl,
            domain: parsed.domain,
          },
          ...current.draft.sources,
        ],
      },
    }));

    if (parsed.type === 'YouTube Playlist' || parsed.type === 'YouTube Video') {
      fetch(`/api/import/youtube/metadata?url=${encodeURIComponent(parsed.url)}`)
        .then(res => res.json())
        .then(data => {
          if (data.title || data.thumbnailUrl) {
            setState(current => ({
              ...current,
              draft: {
                ...current.draft,
                sources: current.draft.sources.map(s => 
                  s.id === newSourceId 
                    ? { ...s, title: data.title || s.title, thumbnailUrl: data.thumbnailUrl || s.thumbnailUrl }
                    : s
                )
              }
            }));
          }
        })
        .catch(console.error);
    }
  }, []);

  const removeSource = useCallback((sourceId: string) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sources: current.draft.sources.filter((source) => source.id !== sourceId),
      },
    }));
  }, []);

  const duplicateSource = useCallback((sourceId: string) => {
    setState((current) => {
      const source = current.draft.sources.find((item) => item.id === sourceId);
      if (!source) {
        return current;
      }

      const copy = {
        ...source,
        id: createSourceId(),
        title: source.title ? `${source.title} copy` : '',
        collapsed: false,
      };

      const sources = cloneSources(current.draft.sources);
      const index = sources.findIndex((item) => item.id === sourceId);
      sources.splice(index + 1, 0, copy);

      return {
        ...current,
        draft: {
          ...current.draft,
          sources,
        },
      };
    });
  }, []);

  const toggleSourceCollapse = useCallback((sourceId: string) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sources: current.draft.sources.map((source) =>
          source.id === sourceId ? { ...source, collapsed: !source.collapsed } : source,
        ),
      },
    }));
  }, []);

  const updateSourceField = useCallback(
    <K extends keyof CreateCohortSourceDraft>(
      sourceId: string,
      key: K,
      value: CreateCohortSourceDraft[K],
    ) => {
      setState((current) => ({
        ...current,
        draft: {
          ...current.draft,
          sources: current.draft.sources.map((source) => {
            if (source.id !== sourceId) return source;

            const updated = { ...source, [key]: value };

            if (key === 'url' && typeof value === 'string') {
              const parsed = parseSourceUrlInput(value);
              updated.type = parsed.type;
              if (parsed.domain) updated.domain = parsed.domain;
              if (parsed.thumbnailUrl) updated.thumbnailUrl = parsed.thumbnailUrl;
              if (!source.title && parsed.title) updated.title = parsed.title;
            }

            return updated;
          }),
        },
      }));
    },
    [],
  );

  const moveSource = useCallback((sourceId: string, targetId: string) => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sources: moveItem(current.draft.sources, sourceId, targetId),
      },
    }));
  }, []);

  const cancelImport = useCallback(() => {
    importService.cancelImport(currentJobRef.current);
    currentJobRef.current = null;

    setImportState((current) => ({
      ...current,
      status: 'canceled',
      liveStatus: 'Import canceled',
      currentOperation: 'Import canceled',
      estimatedRemaining: '--',
      currentSourceLabel: '',
    }));

    setState((current) => ({
      ...current,
      currentStep: 'sources',
    }));
  }, []);

  const startImport = useCallback(async () => {
    const draft = stateRef.current.draft;
    if (!validation.sources) {
      return;
    }

    const sources = draft.sources;
    const initialState = createImportState(sources);
    setImportState({
      ...initialState,
      status: 'running',
      currentOperation: 'Queued',
      liveStatus: 'Preparing import',
    });

    const importedSources: ImportedSourceModel[] = [];

    for (const source of sources) {
      const currentImport = importStateRef.current;
      if (currentImport.status === 'canceled') {
        break;
      }

      setImportState((current) => ({
        ...current,
        activeSourceId: source.id,
        currentSourceLabel: source.title || source.type,
        currentOperation: 'Connecting to import service',
        liveStatus: 'Starting source import',
      }));

      setActiveSourceState(source.id, {
        status: 'running',
        progress: 0,
        currentOperation: 'Connecting to source',
        estimatedRemaining: '--',
        liveStatus: 'Starting',
        error: null,
      });

      const job = importService.importSource({
        source,
        signal: new AbortController().signal,
        onEvent: (event) => {
          if (event.type === 'feed') {
            const feedItem = normalizeFeed(event.feed.title, event.feed.detail, event.feed.tone);

            appendFeed(feedItem);
            setActiveSourceState(source.id, (card) => ({
              ...card,
              feed: [feedItem, ...card.feed].slice(0, 8),
            }));
            return;
          }

          if (event.type === 'stage') {
            setActiveSourceState(source.id, (card) => ({
              ...card,
              stages: card.stages.map((stage) =>
                stage.id === event.stage.id
                  ? { ...stage, status: event.stage.status, progress: event.stage.progress }
                  : stage,
              ),
              currentOperation: event.stage.title,
              progress: event.stage.progress,
            }));
            setImportState((current) => ({
              ...current,
              currentOperation: event.stage.title,
            }));
            return;
          }

          if (event.type === 'snapshot') {
            setActiveSourceState(source.id, (card) => ({
              ...card,
              importedSource: event.snapshot.source,
              title: event.snapshot.source.title,
              progress: event.snapshot.overallProgress ?? card.progress,
              currentOperation: event.snapshot.currentOperation ?? card.currentOperation,
              estimatedRemaining: event.snapshot.estimatedRemaining ?? card.estimatedRemaining,
              liveStatus: event.snapshot.liveStatus ?? card.liveStatus,
              status: 'running',
            }));

            setImportState((current) => ({
              ...current,
              overallProgress: event.snapshot.overallProgress ?? current.overallProgress,
              currentOperation: event.snapshot.currentOperation ?? current.currentOperation,
              currentSourceLabel: event.snapshot.currentSourceLabel ?? current.currentSourceLabel,
              estimatedRemaining: event.snapshot.estimatedRemaining ?? current.estimatedRemaining,
              liveStatus: event.snapshot.liveStatus ?? current.liveStatus,
              importedSources: current.importedSources,
            }));
            return;
          }

          if (event.type === 'error') {
            const error = event.error;

            // Handle Corsair OAuth Trigger
            if (error.message?.startsWith('AUTH_REQUIRED|')) {
              const url = error.message.split('|')[1];
              if (url) {
                window.open(url, '_blank');
              }
              
              setActiveSourceState(source.id, (card) => ({
                ...card,
                status: 'failed',
                error: { ...error, message: 'Please authenticate with Notion in the new window, then try again.', title: 'Authentication Required' },
                currentOperation: 'Authentication Required',
                liveStatus: 'Please complete Notion OAuth in the new window.',
              }));
              setImportState((current) => ({
                ...current,
                status: 'failed',
                error: { ...error, message: 'Please authenticate with Notion in the new window, then try again.', title: 'Authentication Required' },
                currentOperation: 'Authentication Required',
                liveStatus: 'Please complete Notion OAuth in the new window.',
                estimatedRemaining: '--',
              }));
              return;
            }

            setActiveSourceState(source.id, (card) => ({
              ...card,
              status: 'failed',
              error,
              currentOperation: error.title,
              liveStatus: error.message,
            }));
            setImportState((current) => ({
              ...current,
              status: 'failed',
              error,
              currentOperation: error.title,
              liveStatus: error.message,
              estimatedRemaining: '--',
            }));
          }
        },
      });

      currentJobRef.current = job;

      try {
        const importedSource = await job.promise;
        importedSources.push(importedSource);

        setActiveSourceState(source.id, (card) => ({
          ...card,
          status: importedSource.status,
          progress: 100,
          currentOperation: 'Completed',
          estimatedRemaining: '0m',
          liveStatus: 'Imported successfully',
          importedSource,
          stages: card.stages.map((stage) =>
            stage.id === 'completed' ? { ...stage, status: 'completed', progress: 100 } : stage,
          ),
        }));

        setImportState((current) => ({
          ...current,
          importedSources: [...importedSources],
          overallProgress: calculateOverallProgress({
            ...current.sourceCards,
            [source.id]: {
              ...current.sourceCards[source.id],
              status: importedSource.status,
              progress: 100,
              importedSource,
            },
          }),
        }));
      } catch (error) {
        if (isAbortError(error)) {
          setImportState((current) => ({
            ...current,
            status: 'canceled',
            liveStatus: 'Import canceled',
            currentOperation: 'Import canceled',
            estimatedRemaining: '--',
          }));
          return;
        }

        const mapped = error as ImportErrorModel;
        setActiveSourceState(source.id, (card) => ({
          ...card,
          status: 'failed',
          error: mapped,
          currentOperation: mapped.title,
          liveStatus: mapped.message,
        }));
        setImportState((current) => ({
          ...current,
          status: 'failed',
          error: mapped,
          currentOperation: mapped.title,
          liveStatus: mapped.message,
          estimatedRemaining: '--',
        }));
        return;
      }
    }

    if (currentJobRef.current) {
      currentJobRef.current = null;
    }

    if (importStateRef.current.status !== 'failed' && importStateRef.current.status !== 'canceled') {
      setImportState((current) => ({
        ...current,
        status: 'completed',
        overallProgress: 100,
        currentOperation: 'Preparing curriculum',
        liveStatus: 'Import complete',
        estimatedRemaining: '0m',
        importedSources: [...importedSources],
      }));

      importStateRef.current = {
        ...importStateRef.current,
        status: 'completed',
        importedSources: [...importedSources],
      };

      const primary = importedSources[0] ?? importStateRef.current.importedSources[0];
      if (primary) {
        setState((current) => ({
          ...current,
          currentStep: 'curriculum',
          draft: {
            ...current.draft,
            title: current.draft.title.trim() || primary.title,
            coverImage: current.draft.coverImage.trim() || primary.thumbnail || '',
            subtitle: current.draft.subtitle.trim() || `by ${primary.creator}`,
            description: current.draft.description.trim() || `Comprehensive cohort journey created from ${primary.title}.`,
            primaryTopic: current.draft.primaryTopic.trim() || primary.title,
            categories: current.draft.categories.length > 0 ? current.draft.categories : ['Programming', 'Tutorial'],
          },
        }));

        setLaunchState((current) => ({
          ...current,
          onboarding: {
            ...current.onboarding,
            welcomeMessage: `Welcome to ${primary.title}! We are thrilled to have you in this cohort.`,
            journeyIntroduction: `In this journey, you will master ${primary.title} step-by-step through structured seasons and practice exercises.`,
          },
        }));
      } else {
        setState((current) => ({
          ...current,
          currentStep: 'curriculum',
        }));
      }

      void generateCurriculumAction(importedSources);
    }
  }, [appendFeed, generateCurriculumAction, setActiveSourceState, validation.sources]);

  const goNext = useCallback(async () => {
    const currentStep = stateRef.current.currentStep;

    if (currentStep === 'topic') {
      setState((current) => ({ ...current, currentStep: 'sources' }));
      return;
    }

    if (currentStep === 'sources') {
      await startImport();
      return;
    }

    if (currentStep === 'curriculum') {
      setState((current) => ({ ...current, currentStep: 'identity' }));
      return;
    }

    if (currentStep === 'identity') {
      setState((current) => ({ ...current, currentStep: 'publish' }));
      return;
    }
  }, [startImport]);

  const retryImport = useCallback(async () => {
    await startImport();
  }, [startImport]);

  // Selection actions
  const selectSeason = useCallback((seasonId: string | null) => {
    setCurriculumState((current) => ({
      ...current,
      selectedSeasonId: seasonId,
      selectedLessonId: null,
      multiSelection: { selectedLessonIds: [], selectedSeasonIds: seasonId ? [seasonId] : [] },
    }));
  }, []);

  const selectLesson = useCallback((lessonId: string | null) => {
    setCurriculumState((current) => {
      let ownerSeasonId = current.selectedSeasonId;
      if (lessonId && current.curriculum) {
        for (const season of current.curriculum.seasons) {
          if (season.lessons.some((l) => l.id === lessonId)) {
            ownerSeasonId = season.id;
            break;
          }
        }
      }
      return {
        ...current,
        selectedLessonId: lessonId,
        selectedSeasonId: ownerSeasonId,
        multiSelection: { selectedLessonIds: lessonId ? [lessonId] : [], selectedSeasonIds: [] },
      };
    });
  }, []);

  const toggleSelectLesson = useCallback((lessonId: string, isMulti?: boolean) => {
    setCurriculumState((current) => {
      const selected = current.multiSelection.selectedLessonIds;
      const exists = selected.includes(lessonId);

      let nextSelected: string[];
      if (isMulti) {
        nextSelected = exists ? selected.filter((id) => id !== lessonId) : [...selected, lessonId];
      } else {
        nextSelected = exists && selected.length === 1 ? [] : [lessonId];
      }

      return {
        ...current,
        selectedLessonId: nextSelected[0] ?? null,
        multiSelection: {
          selectedLessonIds: nextSelected,
          selectedSeasonIds: [],
        },
      };
    });
  }, []);

  const toggleSelectSeason = useCallback((seasonId: string, isMulti?: boolean) => {
    setCurriculumState((current) => {
      const selected = current.multiSelection.selectedSeasonIds;
      const exists = selected.includes(seasonId);

      let nextSelected: string[];
      if (isMulti) {
        nextSelected = exists ? selected.filter((id) => id !== seasonId) : [...selected, seasonId];
      } else {
        nextSelected = exists && selected.length === 1 ? [] : [seasonId];
      }

      return {
        ...current,
        selectedSeasonId: nextSelected[0] ?? null,
        multiSelection: {
          selectedLessonIds: [],
          selectedSeasonIds: nextSelected,
        },
      };
    });
  }, []);

  const clearMultiSelection = useCallback(() => {
    setCurriculumState((current) => ({
      ...current,
      multiSelection: { selectedLessonIds: [], selectedSeasonIds: [] },
    }));
  }, []);

  const selectAllLessons = useCallback(() => {
    setCurriculumState((current) => {
      if (!current.curriculum) return current;
      const allIds = current.curriculum.seasons.flatMap((s) => s.lessons.map((l) => l.id));
      return {
        ...current,
        multiSelection: { selectedLessonIds: allIds, selectedSeasonIds: [] },
      };
    });
  }, []);

  // History Actions (Undo / Redo)
  const undo = useCallback(() => {
    const stack = historyStackRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0 || !stack[currentIndex - 1]) return;

    historyIndexRef.current = currentIndex - 1;
    const previous = stack[currentIndex - 1];

    setCurriculumState((current) => ({
      ...current,
      curriculum: previous,
      saveStatus: 'saved',
      history: {
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < stack.length - 1,
        historyLength: stack.length,
      },
    }));
  }, []);

  const redo = useCallback(() => {
    const stack = historyStackRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex >= stack.length - 1 || !stack[currentIndex + 1]) return;

    historyIndexRef.current = currentIndex + 1;
    const next = stack[currentIndex + 1];

    setCurriculumState((current) => ({
      ...current,
      curriculum: next,
      saveStatus: 'saved',
      history: {
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < stack.length - 1,
        historyLength: stack.length,
      },
    }));
  }, []);

  // Editor Actions with History Integration
  const toggleSeasonCollapse = useCallback((seasonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const season = curriculumStateRef.current.curriculum.seasons.find((s) => s.id === seasonId);
    const updated = updateSeasonLocal(curriculumStateRef.current.curriculum, seasonId, {
      collapsed: !season?.collapsed,
    });
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const toggleLessonCollapse = useCallback((seasonId: string, lessonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const season = curriculumStateRef.current.curriculum.seasons.find((s) => s.id === seasonId);
    const lesson = season?.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const updated = updateLessonLocal(curriculumStateRef.current.curriculum, lessonId, {
      collapsed: !lesson.collapsed,
    });
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const updateCurriculumMeta = useCallback((patch: Partial<GeneratedCurriculum>) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = updateCurriculumMetaLocal(curriculumStateRef.current.curriculum, patch);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const addSeason = useCallback((title?: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = createSeasonLocal(curriculumStateRef.current.curriculum, title);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const updateSeason = useCallback((seasonId: string, patch: Partial<CurriculumSeason>) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = updateSeasonLocal(curriculumStateRef.current.curriculum, seasonId, patch);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const deleteSeason = useCallback((seasonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = deleteSeasonLocal(curriculumStateRef.current.curriculum, seasonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const duplicateSeason = useCallback((seasonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = duplicateSeasonLocal(curriculumStateRef.current.curriculum, seasonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const splitSeason = useCallback((seasonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = splitSeasonLocal(curriculumStateRef.current.curriculum, seasonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const mergeSeasons = useCallback((seasonId: string, targetSeasonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = mergeSeasonsLocal(curriculumStateRef.current.curriculum, seasonId, targetSeasonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const moveSeason = useCallback((seasonId: string, targetId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = moveSeasonLocal(curriculumStateRef.current.curriculum, seasonId, targetId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const updateLesson = useCallback((lessonId: string, patch: Partial<CurriculumLesson>) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = updateLessonLocal(curriculumStateRef.current.curriculum, lessonId, patch);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const deleteLesson = useCallback((lessonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = deleteLessonLocal(curriculumStateRef.current.curriculum, lessonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const duplicateLesson = useCallback((lessonId: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = duplicateLessonLocal(curriculumStateRef.current.curriculum, lessonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const moveLesson = useCallback((lessonId: string, targetSeasonId: string, targetLessonId?: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = moveLessonLocal(curriculumStateRef.current.curriculum, lessonId, targetSeasonId, targetLessonId);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const autoBalance = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = autoBalanceCurriculum(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const regenerateChunksAction = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = regenerateChunksForCurriculum(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const restorePlaylistOrderAction = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = rebuildFromPlaylistOrder(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  // Bulk Operation dispatchers
  const autoRenameSeasons = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.autoRenameSeasons(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const autoRenameLessons = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.autoRenameLessons(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const regenerateChunkTitles = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.regenerateChunkTitles(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const normalizeDurations = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.normalizeDurations(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const mergeEmptySeasons = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.mergeEmptySeasons(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const deleteEmptyLessons = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const updated = bulkOperationsService.deleteEmptyLessons(curriculumStateRef.current.curriculum);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const bulkTag = useCallback((tag: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const selected = curriculumStateRef.current.multiSelection.selectedLessonIds;
    const updated = bulkOperationsService.bulkTag(curriculumStateRef.current.curriculum, selected, tag);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const bulkDifficulty = useCallback((difficulty: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const selected = curriculumStateRef.current.multiSelection.selectedLessonIds;
    const updated = bulkOperationsService.bulkDifficulty(curriculumStateRef.current.curriculum, selected, difficulty);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const bulkXP = useCallback((xp: number) => {
    if (!curriculumStateRef.current.curriculum) return;
    const selected = curriculumStateRef.current.multiSelection.selectedLessonIds;
    const updated = bulkOperationsService.bulkXP(curriculumStateRef.current.curriculum, selected, xp);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const bulkVisibility = useCallback((visibility: string) => {
    if (!curriculumStateRef.current.curriculum) return;
    const selected = curriculumStateRef.current.multiSelection.selectedLessonIds;
    const updated = bulkOperationsService.bulkVisibility(curriculumStateRef.current.curriculum, selected, visibility);
    updateCurriculumWithHistory(updated);
  }, [updateCurriculumWithHistory]);

  const bulkDeleteSelected = useCallback(() => {
    if (!curriculumStateRef.current.curriculum) return;
    const { selectedLessonIds, selectedSeasonIds } = curriculumStateRef.current.multiSelection;
    const updated = bulkOperationsService.bulkDelete(
      curriculumStateRef.current.curriculum,
      selectedLessonIds,
      selectedSeasonIds,
    );
    clearMultiSelection();
    updateCurriculumWithHistory(updated);
  }, [clearMultiSelection, updateCurriculumWithHistory]);

  const expandAllSeasons = useCallback(() => {
    setCurriculumState((current) => {
      if (!current.curriculum) return current;
      const seasons = current.curriculum.seasons.map((s) => ({ ...s, collapsed: false }));
      return { ...current, curriculum: { ...current.curriculum, seasons } };
    });
  }, []);

  const collapseAllSeasons = useCallback(() => {
    setCurriculumState((current) => {
      if (!current.curriculum) return current;
      const seasons = current.curriculum.seasons.map((s) => ({ ...s, collapsed: true }));
      return { ...current, curriculum: { ...current.curriculum, seasons } };
    });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setCurriculumState((current) => ({ ...current, searchQuery: query }));
  }, []);

  const setFilterWarningOnly = useCallback((filter: boolean) => {
    setCurriculumState((current) => ({ ...current, filterWarningOnly: filter }));
  }, []);

  // Prompt 5 Launch Actions
  const updateOnboarding = useCallback((patch: Partial<OnboardingConfigModel>) => {
    setLaunchState((current) => ({
      ...current,
      onboarding: { ...current.onboarding, ...patch },
    }));
  }, []);

  const toggleCommunityFeature = useCallback((key: keyof CommunityConfigModel) => {
    setLaunchState((current) => ({
      ...current,
      community: {
        ...current.community,
        [key]: !current.community[key],
      },
    }));
  }, []);

  const updateJourneySettings = useCallback((patch: Partial<JourneySettingsModel>) => {
    setLaunchState((current) => ({
      ...current,
      journeySettings: { ...current.journeySettings, ...patch },
    }));
  }, []);

  const setDeviceViewport = useCallback((viewport: DeviceViewport) => {
    setLaunchState((current) => ({ ...current, deviceViewport: viewport }));
  }, []);

  const setPreviewTab = useCallback((tab: LearnerPreviewTab) => {
    setLaunchState((current) => ({ ...current, previewTab: tab }));
  }, []);

  const publishCohort = useCallback(async (forcePublishWithWeights?: boolean) => {
    const draftValidation = validateCohortDraftSecurity(stateRef.current.draft);
    if (!draftValidation.valid) {
      setLaunchState((current) => ({
        ...current,
        publishStage: 'idle',
        publishError: draftValidation.errors.join('; '),
      }));
      return;
    }

    setLaunchState((current) => ({
      ...current,
      publishStage: 'preparing-assets',
      publishError: null,
      isWeightsModalOpen: false,
    }));

    try {
      const result = await publishService.publishCohort(
        {
          draft: draftValidation.sanitizedDraft,
          curriculum: curriculumStateRef.current.curriculum!,
          onboarding: launchStateRef.current.onboarding,
          community: launchStateRef.current.community,
          journeySettings: launchStateRef.current.journeySettings,
          qualityScore: 92,
          forcePublishWithWeights,
        },
        (stage) => {
          setLaunchState((curr) => ({ ...curr, publishStage: stage }));
        },
      );

      setLaunchState((current) => ({
        ...current,
        publishStage: 'live',
        publishResult: result,
        publishError: null,
      }));
    } catch (err) {
      if ((err as any).code === 'WEIGHTS_REQUIRED' || (err instanceof Error && err.message === 'WEIGHTS_REQUIRED')) {
        setLaunchState((current) => ({
          ...current,
          publishStage: 'idle',
          publishError: null,
          isWeightsModalOpen: true,
        }));
        return;
      }

      const message = err instanceof Error ? err.message : 'Publishing failed';
      setLaunchState((current) => ({
        ...current,
        publishStage: 'idle',
        publishError: message,
      }));
    }
  }, []);

  const resetLaunch = useCallback(() => {
    setLaunchState((current) => ({
      ...current,
      publishStage: 'idle',
      publishResult: null,
      publishError: null,
    }));
  }, []);

  const closeWeightsModal = useCallback(() => {
    setLaunchState((current) => ({
      ...current,
      isWeightsModalOpen: false,
    }));
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      validation,
      importState,
      curriculumState,
      launchState,
      actions: {
        setStep,
        goPrevious,
        goNext,
        startImport,
        cancelImport,
        retryImport,
        updateDraftField,
        toggleCategory,
        addTag,
        removeTag,
        addRequirement,
        updateRequirement,
        removeRequirement,
        addLearningOutcome,
        updateLearningOutcome,
        removeLearningOutcome,
        addSource,
        removeSource,
        duplicateSource,
        toggleSourceCollapse,
        updateSourceField,
        moveSource,
        generateCurriculum: generateCurriculumAction,
        selectSeason,
        selectLesson,
        toggleSeasonCollapse,
        toggleLessonCollapse,
        updateCurriculumMeta,
        addSeason,
        updateSeason,
        deleteSeason,
        duplicateSeason,
        splitSeason,
        mergeSeasons,
        moveSeason,
        updateLesson,
        deleteLesson,
        duplicateLesson,
        moveLesson,
        autoBalance,
        regenerateChunks: regenerateChunksAction,
        restorePlaylistOrder: restorePlaylistOrderAction,
        setSearchQuery,
        setFilterWarningOnly,
        toggleSelectLesson,
        toggleSelectSeason,
        clearMultiSelection,
        selectAllLessons,
        undo,
        redo,
        autoRenameSeasons,
        autoRenameLessons,
        regenerateChunkTitles,
        normalizeDurations,
        mergeEmptySeasons,
        deleteEmptyLessons,
        bulkTag,
        bulkDifficulty,
        bulkXP,
        bulkVisibility,
        bulkDeleteSelected,
        expandAllSeasons,
        collapseAllSeasons,
        updateOnboarding,
        toggleCommunityFeature,
        updateJourneySettings,
        setDeviceViewport,
        setPreviewTab,
        publishCohort,
        resetLaunch,
        closeWeightsModal,
      },
    }),
    [
      state,
      validation,
      importState,
      curriculumState,
      launchState,
      setStep,
      goPrevious,
      goNext,
      startImport,
      cancelImport,
      retryImport,
      updateDraftField,
      toggleCategory,
      addTag,
      removeTag,
      addRequirement,
      updateRequirement,
      removeRequirement,
      addLearningOutcome,
      updateLearningOutcome,
      removeLearningOutcome,
      addSource,
      removeSource,
      duplicateSource,
      toggleSourceCollapse,
      updateSourceField,
      moveSource,
      generateCurriculumAction,
      selectSeason,
      selectLesson,
      toggleSeasonCollapse,
      toggleLessonCollapse,
      updateCurriculumMeta,
      addSeason,
      updateSeason,
      deleteSeason,
      duplicateSeason,
      splitSeason,
      mergeSeasons,
      moveSeason,
      updateLesson,
      deleteLesson,
      duplicateLesson,
      moveLesson,
      autoBalance,
      regenerateChunksAction,
      restorePlaylistOrderAction,
      setSearchQuery,
      setFilterWarningOnly,
      toggleSelectLesson,
      toggleSelectSeason,
      clearMultiSelection,
      selectAllLessons,
      undo,
      redo,
      autoRenameSeasons,
      autoRenameLessons,
      regenerateChunkTitles,
      normalizeDurations,
      mergeEmptySeasons,
      deleteEmptyLessons,
      bulkTag,
      bulkDifficulty,
      bulkXP,
      bulkVisibility,
      bulkDeleteSelected,
      expandAllSeasons,
      collapseAllSeasons,
      updateOnboarding,
      toggleCommunityFeature,
      updateJourneySettings,
      setDeviceViewport,
      setPreviewTab,
      publishCohort,
      resetLaunch,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizardContext() {
  const context = useContext(WizardContext);

  if (!context) {
    throw new Error('useWizardContext must be used within a WizardProvider');
  }

  return context;
}
