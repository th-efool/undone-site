'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { createCohortMockDraft, sourceTypeOptions } from '../mock/createCohort.mock';
import {
  createCohortStepLabels,
  createCohortStepOrder,
  type CreateCohortDraft,
  type CreateCohortSourceDraft,
  type CreateCohortStepId,
  type CreateCohortWizardState,
} from '../models/createCohort';

interface WizardContextValue {
  state: CreateCohortWizardState;
  validation: {
    details: boolean;
    sources: boolean;
  };
  actions: {
    setStep: (step: CreateCohortStepId) => void;
    goPrevious: () => void;
    goNext: () => void;
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

export function WizardProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<CreateCohortWizardState>({
    currentStep: 'details',
    draft: createCohortMockDraft,
  });

  const validation = useMemo(
    () => ({
      details: validateDetails(state.draft),
      sources: validateSources(state.draft),
    }),
    [state.draft],
  );

  const setStep = useCallback((step: CreateCohortStepId) => {
    setState((current) => {
      const currentIndex = createCohortStepOrder.indexOf(current.currentStep);
      const targetIndex = createCohortStepOrder.indexOf(step);

      if (targetIndex < 0 || targetIndex > 1) {
        return current;
      }

      if (targetIndex > currentIndex) {
        if (current.currentStep === 'details' && !validateDetails(current.draft)) {
          return current;
        }
        if (current.currentStep === 'sources') {
          return current;
        }
      }

      return {
        ...current,
        currentStep: step,
      };
    });
  }, []);

  const goPrevious = useCallback(() => {
    setState((current) => {
      if (current.currentStep !== 'sources') {
        return current;
      }

      return {
        ...current,
        currentStep: 'details',
      };
    });
  }, []);

  const goNext = useCallback(() => {
    setState((current) => {
      if (current.currentStep === 'details' && validateDetails(current.draft)) {
        return {
          ...current,
          currentStep: 'sources',
        };
      }

      return current;
    });
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

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      validation,
      actions: {
        setStep,
        goPrevious,
        goNext,
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
      duplicateSource,
      goNext,
      goPrevious,
      moveSource,
      removeLearningOutcome,
      removeRequirement,
      removeSource,
      removeTag,
      setStep,
      state,
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
