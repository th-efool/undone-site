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
import { createCohortMockDraft, sourceTypeOptions } from '../mock/createCohort.mock';
import {
  createCohortStepLabels,
  createCohortStepOrder,
  type CreateCohortDraft,
  type CreateCohortSourceDraft,
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

interface WizardContextValue {
  state: CreateCohortWizardState;
  validation: {
    details: boolean;
    sources: boolean;
  };
  importState: WizardImportState;
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
    addSource: () => void;
    removeSource: (sourceId: string) => void;
    duplicateSource: (sourceId: string) => void;
    toggleSourceCollapse: (sourceId: string) => void;
    updateSourceField: <K extends keyof CreateCohortSourceDraft>(
      sourceId: string,
      key: K,
      value: CreateCohortSourceDraft[K],
    ) => void;
    moveSource: (sourceId: string, targetId: string) => void;
  };
}

const WizardContext = createContext<WizardContextValue | null>(null);

const importStages: ImportPipelineStageModel[] = [
  {
    id: 'queued',
    title: 'Queued',
    description: 'Waiting for the source to enter the import pipeline.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'validating-url',
    title: 'Validating URL',
    description: 'Checking that the source can be imported.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'connecting',
    title: 'Connecting to YouTube',
    description: 'Resolving the playlist against the YouTube Data API.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'playlist-metadata',
    title: 'Reading Playlist Metadata',
    description: 'Fetching playlist title, description, creator, and artwork.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'playlist-videos',
    title: 'Fetching Playlist Videos',
    description: 'Paging through every playlist item until the list is complete.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'video-details',
    title: 'Fetching Video Details',
    description: 'Downloading video metadata and ISO8601 durations in batches.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'durations',
    title: 'Calculating Durations',
    description: 'Converting durations into renderable labels.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'curriculum',
    title: 'Preparing Curriculum',
    description: 'Packaging imported lessons for the next step.',
    status: 'pending',
    progress: 0,
  },
  {
    id: 'completed',
    title: 'Completed',
    description: 'The source is ready for the curriculum step.',
    status: 'pending',
    progress: 0,
  },
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
  return Boolean(
    draft.title.trim() &&
      draft.subtitle.trim() &&
      draft.description.trim() &&
      draft.primaryTopic.trim() &&
      draft.estimatedCompletionTime.trim() &&
      draft.language.trim() &&
      draft.categories.length > 0 &&
      draft.tags.length > 0 &&
      draft.requirements.length > 0 &&
      draft.learningOutcomes.length > 0,
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
    error instanceof DOMException && error.name === 'AbortError'
  ) || (error instanceof Error && error.name === 'AbortError');
}

export function WizardProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<CreateCohortWizardState>({
    currentStep: 'details',
    draft: createCohortMockDraft,
  });
  const [importState, setImportState] = useState<WizardImportState>(() =>
    createImportState(createCohortMockDraft.sources),
  );

  const stateRef = useRef(state);
  const importStateRef = useRef(importState);
  const currentJobRef = useRef<ImportSourceJob | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    importStateRef.current = importState;
  }, [importState]);

  const validation = useMemo(
    () => ({
      details: validateDetails(state.draft),
      sources: validateSources(state.draft),
    }),
    [state.draft],
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

  const setStep = useCallback((step: CreateCohortStepId) => {
    setState((current) => {
      const targetIndex = createCohortStepOrder.indexOf(step);
      if (targetIndex < 0 || targetIndex > 2) {
        return current;
      }

      if (step === 'curriculum' && importStateRef.current.status !== 'completed') {
        return current;
      }

      if (step === 'sources' && current.currentStep === 'curriculum') {
        return {
          ...current,
          currentStep: step,
        };
      }

      if (step === 'details') {
        return {
          ...current,
          currentStep: step,
        };
      }

      return current;
    });
  }, []);

  const goPrevious = useCallback(() => {
    setState((current) => {
      if (current.currentStep === 'sources') {
        return {
          ...current,
          currentStep: 'details',
        };
      }

      if (current.currentStep === 'curriculum') {
        return {
          ...current,
          currentStep: 'sources',
        };
      }

      return current;
    });
  }, []);

  const goNext = useCallback(async () => {
    const currentStep = stateRef.current.currentStep;

    if (currentStep === 'details') {
      setState((current) => ({
        ...current,
        currentStep: 'sources',
      }));
      return;
    }

    if (currentStep === 'sources') {
      await startImport();
    }
  }, []);

  const updateDraftField = useCallback(
    <K extends keyof CreateCohortDraft>(key: K, value: CreateCohortDraft[K]) => {
      setState((current) => ({
        ...current,
        draft: {
          ...current.draft,
          [key]: value,
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
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        tags: insertUnique(current.draft.tags, tag),
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
    const next = value.trim();
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
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        requirements: current.draft.requirements.map((item, currentIndex) =>
          currentIndex === index ? value : item,
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
    const next = value.trim();
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
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        learningOutcomes: current.draft.learningOutcomes.map((item, currentIndex) =>
          currentIndex === index ? value : item,
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

  const addSource = useCallback(() => {
    setState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sources: [
          ...current.draft.sources,
          {
            id: createSourceId(),
            type: sourceTypeOptions[0],
            title: 'New source',
            url: 'https://',
            collapsed: false,
          },
        ],
      },
    }));
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
        title: `${source.title} copy`,
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
          sources: current.draft.sources.map((source) =>
            source.id === sourceId ? { ...source, [key]: value } : source,
          ),
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

    const latest = importStateRef.current;
    if (latest.status !== 'failed' && latest.status !== 'canceled') {
      setImportState((current) => ({
        ...current,
        status: 'completed',
        overallProgress: 100,
        currentOperation: 'Preparing curriculum',
        liveStatus: 'Import complete',
        estimatedRemaining: '0m',
      }));

      setState((current) => ({
        ...current,
        currentStep: 'curriculum',
      }));
    }
  }, [appendFeed, setActiveSourceState, validation.sources]);

  const retryImport = useCallback(async () => {
    await startImport();
  }, [startImport]);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      validation,
      importState,
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
      },
    }),
    [
      addLearningOutcome,
      addRequirement,
      addSource,
      addTag,
      cancelImport,
      duplicateSource,
      goNext,
      goPrevious,
      importState,
      moveSource,
      removeLearningOutcome,
      removeRequirement,
      removeSource,
      removeTag,
      retryImport,
      setStep,
      state,
      startImport,
      toggleCategory,
      toggleSourceCollapse,
      updateDraftField,
      updateRequirement,
      updateSourceField,
      validation,
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
