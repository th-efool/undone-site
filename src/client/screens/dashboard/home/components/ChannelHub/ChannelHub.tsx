'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Coffee,
  Compass,
  Hammer,
  Headphones,
  Search,
  Zap,
  Clock,
  BarChart2,
  Bell,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  HelpCircle,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  homeStorageAdapter,
  type ChannelId,
  type SaveStatus,
} from '@/src/client/repositories/homeStorageAdapter';
import styles from './ChannelHub.module.css';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

// ─── Data & Types ────────────────────────────────────────────────────────────

export type { ChannelId } from '@/src/client/repositories/homeStorageAdapter';

export interface ChannelParamConfig {
  id: string;
  label: string;
  minLabel: string;
  maxLabel: string;
  defaultVal: number; // 0.00 to 1.00
  tooltip: string;
}

export interface LearningChannel {
  id: ChannelId;
  name: string;
  Icon: React.ElementType;
  tagline: string;
  params: [ChannelParamConfig, ChannelParamConfig, ChannelParamConfig];
}

export const CHANNELS: LearningChannel[] = [
  {
    id: 'spark',
    name: 'Spark',
    Icon: Coffee,
    tagline: 'Fresh ideas to ignite your curiosity across distant domains.',
    params: [
      {
        id: 'novelty',
        label: 'Novelty',
        minLabel: 'Familiar',
        maxLabel: 'Esoteric',
        defaultVal: 0.65,
        tooltip: 'Balance between familiar fundamentals and esoteric discoveries',
      },
      {
        id: 'connectivity',
        label: 'Connectivity',
        minLabel: 'Singular',
        maxLabel: 'Cross-Domain',
        defaultVal: 0.50,
        tooltip: 'Focus on a single domain vs. bridging unexpected disciplines',
      },
      {
        id: 'abstraction',
        label: 'Abstraction',
        minLabel: 'Concrete Fact',
        maxLabel: 'Philosophical',
        defaultVal: 0.45,
        tooltip: 'Ground in tangible facts vs. theoretical, philosophical concepts',
      },
    ],
  },
  {
    id: 'explore',
    name: 'Explore',
    Icon: Compass,
    tagline: 'Discover new topics, adjacent perspectives, and uncharted ideas.',
    params: [
      {
        id: 'novelty',
        label: 'Novelty',
        minLabel: 'Adjacent',
        maxLabel: 'Uncharted',
        defaultVal: 0.60,
        tooltip: 'Stay near known topics vs venturing into uncharted waters',
      },
      {
        id: 'scope',
        label: 'Scope',
        minLabel: 'Deep Focus',
        maxLabel: 'Wide Horizon',
        defaultVal: 0.70,
        tooltip: 'Narrow specialist concentration vs panoramic interdisciplinary view',
      },
      {
        id: 'serendipity',
        label: 'Serendipity',
        minLabel: 'Curated',
        maxLabel: 'Random',
        defaultVal: 0.55,
        tooltip: 'Algorithmic curation vs spontaneous unexpected surprises',
      },
    ],
  },
  {
    id: 'build',
    name: 'Build',
    Icon: Hammer,
    tagline: 'Hands-on learning with active exercises, projects, and sandboxes.',
    params: [
      {
        id: 'guidance',
        label: 'Guidance',
        minLabel: 'Step-by-Step',
        maxLabel: 'Independent',
        defaultVal: 0.40,
        tooltip: 'Step-by-step walkthroughs vs self-directed open engineering',
      },
      {
        id: 'scope',
        label: 'Scope',
        minLabel: 'Micro-Feature',
        maxLabel: 'Full-Scale App',
        defaultVal: 0.50,
        tooltip: 'Targeted single components vs complete end-to-end architectures',
      },
      {
        id: 'constraint',
        label: 'Constraint',
        minLabel: 'Strict Blueprint',
        maxLabel: 'Open Sandbox',
        defaultVal: 0.60,
        tooltip: 'Rigid rubric guidelines vs unbounded creative exploration',
      },
    ],
  },
  {
    id: 'listen',
    name: 'Listen',
    Icon: Headphones,
    tagline: 'Learn on the go with narrated audio sessions and dialogs.',
    params: [
      {
        id: 'format',
        label: 'Format',
        minLabel: 'Story',
        maxLabel: 'Interview',
        defaultVal: 0.50,
        tooltip: 'Narrative storytelling vs in-depth dialog and interviews',
      },
      {
        id: 'density',
        label: 'Density',
        minLabel: 'Casual Overview',
        maxLabel: 'Technical Deep',
        defaultVal: 0.55,
        tooltip: 'Conversational overview vs mathematically rigorous breakdown',
      },
      {
        id: 'length',
        label: 'Duration',
        minLabel: 'Short Audio',
        maxLabel: 'Extended Audio',
        defaultVal: 0.45,
        tooltip: 'Quick 5-minute clips vs comprehensive 45-minute deep dives',
      },
    ],
  },
  {
    id: 'deep_dive',
    name: 'Deep Dive',
    Icon: Search,
    tagline: 'First-principles analysis, mathematical rigor, and structured depth.',
    params: [
      {
        id: 'depth',
        label: 'Depth',
        minLabel: 'High-Level',
        maxLabel: 'First Principles',
        defaultVal: 0.75,
        tooltip: 'Intuitive mental models vs foundational ground-truth theorems',
      },
      {
        id: 'rigor',
        label: 'Rigor',
        minLabel: 'Intuitive',
        maxLabel: 'Formal Proof',
        defaultVal: 0.70,
        tooltip: 'Heuristic explanations vs formal proofs and edge cases',
      },
      {
        id: 'scaffolding',
        label: 'Scaffolding',
        minLabel: 'Guided Hints',
        maxLabel: 'Independent',
        defaultVal: 0.35,
        tooltip: 'Explanatory hints along the way vs solitary problem solving',
      },
    ],
  },
  {
    id: 'quick',
    name: 'Quick',
    Icon: Zap,
    tagline: 'Bite-sized micro-lessons engineered for busy 5-minute windows.',
    params: [
      {
        id: 'length',
        label: 'Length',
        minLabel: 'Micro (2m)',
        maxLabel: 'Brief (10m)',
        defaultVal: 0.30,
        tooltip: 'Ultra-condensed flashes vs 10-minute targeted exercises',
      },
      {
        id: 'continuity',
        label: 'Continuity',
        minLabel: 'Standalone',
        maxLabel: 'Sequence',
        defaultVal: 0.50,
        tooltip: 'Self-contained discrete cards vs progressive linked sequences',
      },
      {
        id: 'density',
        label: 'Density',
        minLabel: 'Light',
        maxLabel: 'Dense',
        defaultVal: 0.65,
        tooltip: 'Single high-impact takeaway vs packed reference cheat-sheet',
      },
    ],
  },
];

const DEFAULT_PREFS = {
  weeklyGoal: '8 hours',
  learningAllocation: 'Balanced',
  reminderWindow: 'Evening',
};

// ─── Channel Tabs Component (Memoized) ───────────────────────────────────────

export interface ChannelTabsProps {
  selectedChannel: ChannelId;
  onSelect: (id: ChannelId) => void;
}

export const ChannelTabs = React.memo(function ChannelTabs({
  selectedChannel,
  onSelect,
}: ChannelTabsProps) {
  return (
    <div className={styles.iconTabsRow} role="tablist" aria-label="Select learning style">
      {CHANNELS.map((ch) => {
        const isActive = ch.id === selectedChannel;
        const IconComponent = ch.Icon;
        return (
          <button
            key={ch.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={`${ch.name} — ${ch.tagline}`}
            className={`${styles.iconTab} ${isActive ? styles.iconTabActive : ''}`}
            onClick={() => onSelect(ch.id)}
          >
            <IconComponent
              size={20}
              strokeWidth={2.1}
              className={styles.iconSvg}
            />
          </button>
        );
      })}
    </div>
  );
});

// ─── Custom Pointer-Captured Slider (Zero Native Text-Select Bug) ────────────

interface CustomTrackSliderProps {
  label: string;
  tooltip: string;
  minLabel?: string;
  maxLabel?: string;
  value: number; // Strictly 0.00 to 1.00
  onChange: (val: number) => void;
}

const CustomTrackSlider = React.memo(function CustomTrackSlider({
  label,
  tooltip,
  minLabel,
  maxLabel,
  value,
  onChange,
}: CustomTrackSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Strictly clamp value between 0.00 and 1.00
  const clampedValue = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));

  const updateFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const thumbRadius = 9;
      const usableWidth = rect.width - thumbRadius * 2;
      const rawRatio = usableWidth > 0 ? (clientX - rect.left - thumbRadius) / usableWidth : (clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0, Math.min(1, rawRatio));
      const rounded = Math.round(clampedRatio * 100) / 100;
      onChange(rounded);
    },
    [onChange],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    updateFromPointer(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = clampedValue;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = Math.min(1, Math.round((clampedValue + 0.05) * 100) / 100);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = Math.max(0, Math.round((clampedValue - 0.05) * 100) / 100);
      e.preventDefault();
    } else if (e.key === 'Home') {
      next = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      next = 1;
      e.preventDefault();
    }
    if (next !== clampedValue) {
      onChange(next);
    }
  };

  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderLabelGroup}>
        <span className={styles.sliderName}>{label}</span>
        <span className={styles.sliderHelp} title={tooltip} aria-label={tooltip}>
          <HelpCircle size={13} strokeWidth={2} />
        </span>
      </div>

      <div className={styles.sliderCenterCol}>
        <div
          ref={trackRef}
          className={`${styles.sliderTrackWrapper} ${isDragging ? styles.trackDragging : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={clampedValue}
          aria-valuetext={`${label}: ${clampedValue.toFixed(2)}`}
          onKeyDown={handleKeyDown}
        >
          {/* Progress fill */}
          <div
            className={styles.sliderProgressFill}
            style={{ width: clampedValue === 0 ? '0%' : `calc(9px + (100% - 18px) * ${clampedValue})` }}
          />
          {/* Custom thumb */}
          <div
            className={styles.sliderThumb}
            style={{ left: `calc(9px + (100% - 18px) * ${clampedValue})` }}
          />
        </div>

        {(minLabel || maxLabel) && (
          <div className={styles.dichotomyLabels}>
            <span className={styles.minDichotomyLabel}>{minLabel}</span>
            <span className={styles.maxDichotomyLabel}>{maxLabel}</span>
          </div>
        )}
      </div>

      <div className={styles.sliderValueBadge}>
        <span className={styles.plusBox}>
          <span className={styles.plusSign}>+</span>
        </span>
        <span className={styles.valueNumber}>{clampedValue.toFixed(2)}</span>
      </div>
    </div>
  );
});

// ─── Custom Animated Dropdown Popover ────────────────────────────────────────

interface CustomDropdownProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  disabled?: boolean;
  badge?: string;
}

const CustomDropdown = React.memo(function CustomDropdown({
  label,
  icon,
  value,
  options,
  onChange,
  disabled,
  badge,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlDisabled = Boolean(disabled);

  useEffect(() => {
    if (!isOpen || isControlDisabled) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isControlDisabled]);

  return (
    <div className={styles.dailyPrefRow} ref={containerRef}>
      <div className={styles.dailyPrefLabel}>
        {icon}
        <span>{label}</span>
      </div>

      <div className={styles.dropdownContainer}>
        <button
          type="button"
          className={`${styles.customDropdownBtn} ${isOpen ? styles.dropdownBtnActive : ''} ${isControlDisabled ? styles.dropdownBtnDisabled : ''}`}
          onClick={() => {
            if (!isControlDisabled) setIsOpen((prev) => !prev);
          }}
          disabled={isControlDisabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-disabled={isControlDisabled}
        >
          <span className={styles.dropdownValueText}>{badge || value}</span>
          {!isControlDisabled && (
            <ChevronDown
              size={14}
              className={`${styles.dropdownChevron} ${isOpen ? styles.chevronOpen : ''}`}
            />
          )}
        </button>

        {!isControlDisabled && isOpen && (
          <ul className={styles.dropdownPopover} role="listbox">
            {options.map((opt) => {
              const isSelected = opt === value;
              return (
                <li
                  key={opt}
                  className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ''}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span>{opt}</span>
                  {isSelected && <Check size={13} strokeWidth={2.5} className={styles.checkIcon} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
});

// ─── Goal Preferences Component (Memoized) ───────────────────────────────────

export interface GoalPreferencesProps {
  weeklyGoal: string;
  learningAllocation: string;
  reminderWindow: string;
  onWeeklyGoalChange: (val: string) => void;
  onAllocationChange: (val: string) => void;
  onReminderChange: (val: string) => void;
}

const WEEKLY_GOAL_OPTIONS = ['4 hours', '6 hours', '8 hours', '12 hours', '16 hours'];
const ALLOCATION_OPTIONS = ['Focused', 'Balanced', 'Exploratory', 'Intense'];
const REMINDER_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night', 'None'];

export const GoalPreferences = React.memo(function GoalPreferences({
  weeklyGoal,
  learningAllocation,
  reminderWindow,
  onWeeklyGoalChange,
  onAllocationChange,
  onReminderChange,
}: GoalPreferencesProps) {
  return (
    <div className={styles.rightCol}>
      <div className={styles.subheadRow}>
        <span className={styles.subhead}>Daily preferences</span>
      </div>

      <div className={styles.dailyPrefsList}>
        <CustomDropdown
          label="Weekly learning goal"
          icon={<Clock size={15} className={styles.prefIcon} />}
          value={weeklyGoal}
          options={WEEKLY_GOAL_OPTIONS}
          onChange={onWeeklyGoalChange}
          disabled={true}
          badge="Coming later"
        />

        <CustomDropdown
          label="Learning allocation"
          icon={<BarChart2 size={15} className={styles.prefIcon} />}
          value={learningAllocation}
          options={ALLOCATION_OPTIONS}
          onChange={onAllocationChange}
          disabled={true}
          badge="Coming later"
        />

        <CustomDropdown
          label="Reminder window"
          icon={<Bell size={15} className={styles.prefIcon} />}
          value={reminderWindow}
          options={REMINDER_OPTIONS}
          onChange={onReminderChange}
          disabled={true}
          badge="Coming later"
        />
      </div>
    </div>
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitialChannelFromUrl(): ChannelId | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('channel') as ChannelId | null;
    if (param && CHANNELS.some((c) => c.id === param)) {
      return param;
    }
  } catch {}
  return null;
}

function syncChannelUrlParam(channelId: ChannelId) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('channel') !== channelId) {
      url.searchParams.set('channel', channelId);
      window.history.replaceState(null, '', url.toString());
    }
  } catch {}
}

// ─── ChannelHub Main Component ───────────────────────────────────────────────

export function ChannelHub() {
  const { data: session, status: authStatus } = useSafeSession();
  const userId = session?.user?.id ?? null;
  const isAuthenticated = authStatus === 'authenticated' && !!userId;

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('spark');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Channel parameter storage map: key is `${channelId}_${paramId}` -> value (number 0..1)
  const [channelParams, setChannelParams] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const ch of CHANNELS) {
      for (const p of ch.params) {
        initial[`${ch.id}_${p.id}`] = p.defaultVal;
      }
    }
    return initial;
  });

  const [weeklyGoal, setWeeklyGoal] = useState<string>(DEFAULT_PREFS.weeklyGoal);
  const [learningAllocation, setLearningAllocation] = useState<string>(
    DEFAULT_PREFS.learningAllocation,
  );
  const [reminderWindow, setReminderWindow] = useState<string>(
    DEFAULT_PREFS.reminderWindow,
  );

  const selectedChannelRef = useRef(selectedChannel);
  const channelParamsRef = useRef(channelParams);
  const weeklyGoalRef = useRef(weeklyGoal);
  const learningAllocationRef = useRef(learningAllocation);
  const reminderWindowRef = useRef(reminderWindow);

  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
    channelParamsRef.current = channelParams;
    weeklyGoalRef.current = weeklyGoal;
    learningAllocationRef.current = learningAllocation;
    reminderWindowRef.current = reminderWindow;
  });

  // Subscribe to user save status
  useEffect(() => {
    return homeStorageAdapter.subscribeToSaveStatus(userId, setSaveStatus);
  }, [userId]);

  // Hydrate state from canonical localStorage and sync with backend on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsExpanded(homeStorageAdapter.getChannelHubExpanded());

    const urlChannel = getInitialChannelFromUrl();
    const storedChannel = urlChannel || homeStorageAdapter.getSelectedChannel(userId);
    setSelectedChannel(storedChannel);
    selectedChannelRef.current = storedChannel;

    const storedPrefs = homeStorageAdapter.getChannelPreferences(userId);
    setWeeklyGoal(storedPrefs.weeklyGoal);
    weeklyGoalRef.current = storedPrefs.weeklyGoal;
    setLearningAllocation(storedPrefs.learningAllocation);
    learningAllocationRef.current = storedPrefs.learningAllocation;
    setReminderWindow(storedPrefs.reminderWindow);
    reminderWindowRef.current = storedPrefs.reminderWindow;

    // Hydrate each channel's dedicated parameters
    const nextParams: Record<string, number> = {};
    for (const ch of CHANNELS) {
      for (const p of ch.params) {
        const val = homeStorageAdapter.getChannelParam(ch.id, p.id, p.defaultVal, userId);
        nextParams[`${ch.id}_${p.id}`] = val;
      }
    }
    setChannelParams(nextParams);
    channelParamsRef.current = nextParams;

    const controller = new AbortController();
    if (isAuthenticated && userId) {
      homeStorageAdapter.syncChannelWithBackend(userId, true, controller.signal).then((res) => {
        if (controller.signal.aborted || !res) return;
        if (!urlChannel && res.activeChannel) {
          setSelectedChannel(res.activeChannel);
          selectedChannelRef.current = res.activeChannel;
        }
        if (res.prefs) {
          setWeeklyGoal(res.prefs.weeklyGoal);
          weeklyGoalRef.current = res.prefs.weeklyGoal;
          setLearningAllocation(res.prefs.learningAllocation);
          learningAllocationRef.current = res.prefs.learningAllocation;
          setReminderWindow(res.prefs.reminderWindow);
          reminderWindowRef.current = res.prefs.reminderWindow;

          const updatedParams: Record<string, number> = {};
          for (const ch of CHANNELS) {
            for (const p of ch.params) {
              updatedParams[`${ch.id}_${p.id}`] = homeStorageAdapter.getChannelParam(
                ch.id,
                p.id,
                p.defaultVal,
                userId
              );
            }
          }
          setChannelParams(updatedParams);
          channelParamsRef.current = updatedParams;
        }
      });
    }

    const onPopState = () => {
      const popped = getInitialChannelFromUrl();
      if (popped) {
        setSelectedChannel(popped);
        selectedChannelRef.current = popped;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      controller.abort();
      window.removeEventListener('popstate', onPopState);
      homeStorageAdapter.flushPendingSave(userId);
    };
  }, [isAuthenticated, userId]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      homeStorageAdapter.saveChannelHubExpanded(next);
      return next;
    });
  }, []);

  const handleChannelSelect = useCallback(
    (channelId: ChannelId) => {
      setSelectedChannel(channelId);
      selectedChannelRef.current = channelId;
      homeStorageAdapter.saveSelectedChannel(channelId, userId);
      syncChannelUrlParam(channelId);
    },
    [userId]
  );

  const handleParamChange = useCallback(
    (channelId: ChannelId, paramId: string, val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      const key = `${channelId}_${paramId}`;
      homeStorageAdapter.saveChannelParam(channelId, paramId, clamped, userId);
      setChannelParams((prev) => ({ ...prev, [key]: clamped }));
      channelParamsRef.current = { ...channelParamsRef.current, [key]: clamped };
    },
    [userId]
  );

  const handleWeeklyGoalChange = useCallback(
    (newGoal: string) => {
      setWeeklyGoal(newGoal);
      weeklyGoalRef.current = newGoal;
      homeStorageAdapter.saveChannelPreferences({ weeklyGoal: newGoal }, userId);
    },
    [userId]
  );

  const handleAllocationChange = useCallback(
    (newAlloc: string) => {
      setLearningAllocation(newAlloc);
      learningAllocationRef.current = newAlloc;
      homeStorageAdapter.saveChannelPreferences({ learningAllocation: newAlloc }, userId);
    },
    [userId]
  );

  const handleReminderChange = useCallback(
    (newReminder: string) => {
      setReminderWindow(newReminder);
      reminderWindowRef.current = newReminder;
      homeStorageAdapter.saveChannelPreferences({ reminderWindow: newReminder }, userId);
    },
    [userId]
  );

  const handleReset = useCallback(() => {
    const activeCh = CHANNELS.find((c) => c.id === selectedChannelRef.current) || CHANNELS[0];
    for (const p of activeCh.params) {
      homeStorageAdapter.saveChannelParam(activeCh.id, p.id, p.defaultVal, userId);
    }
    setChannelParams((prev) => {
      const next = { ...prev };
      for (const p of activeCh.params) {
        next[`${activeCh.id}_${p.id}`] = p.defaultVal;
      }
      channelParamsRef.current = next;
      return next;
    });
    setWeeklyGoal(DEFAULT_PREFS.weeklyGoal);
    weeklyGoalRef.current = DEFAULT_PREFS.weeklyGoal;
    setLearningAllocation(DEFAULT_PREFS.learningAllocation);
    learningAllocationRef.current = DEFAULT_PREFS.learningAllocation;
    setReminderWindow(DEFAULT_PREFS.reminderWindow);
    reminderWindowRef.current = DEFAULT_PREFS.reminderWindow;

    homeStorageAdapter.saveChannelPreferences(
      {
        weeklyGoal: DEFAULT_PREFS.weeklyGoal,
        learningAllocation: DEFAULT_PREFS.learningAllocation,
        reminderWindow: DEFAULT_PREFS.reminderWindow,
      },
      userId
    );
  }, [userId]);

  const activeChannelConfig =
    CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0];

  return (
    <section className={styles.card} aria-label="Fine-tune your feed">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} aria-hidden="true">
            <SlidersHorizontal size={15} strokeWidth={2.5} />
          </div>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>Fine-tune your feed</h2>
            <p className={styles.subtitle}>
              Adjust your learning channels and algorithmic weights to match your cognitive style.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {saveStatus === 'saving' && (
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginRight: '0.5rem',
              }}
            >
              <Check size={12} /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginRight: '0.5rem',
              }}
            >
              Changes not saved
              <button
                type="button"
                onClick={() => homeStorageAdapter.retrySave(userId)}
                style={{
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Retry
              </button>
            </span>
          )}
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            aria-label="Reset tuning parameters to defaults"
          >
            <RotateCcw size={12} strokeWidth={2.4} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className={styles.collapseBtn}
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Collapse feed tuning' : 'Expand feed tuning'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className={styles.bodyGrid}>
          {/* Left Column: Learning Style Tabs & Sliders */}
          <div className={styles.leftCol}>
            <div className={styles.subheadRow}>
              <span className={styles.subhead}>Learning style</span>
            </div>

            {/* Compact 38px button boxes with larger 20px icons & hover tooltips */}
            <ChannelTabs
              selectedChannel={selectedChannel}
              onSelect={handleChannelSelect}
            />

            {/* Active Channel Identity Banner */}
            <div className={styles.activeChannelBanner}>
              <div className={styles.activeChannelBadge} aria-hidden="true">
                <activeChannelConfig.Icon size={14} strokeWidth={2.4} />
              </div>
              <div className={styles.activeChannelText}>
                <span className={styles.activeChannelName}>
                  {activeChannelConfig.name}
                </span>
                <span className={styles.activeChannelDivider}>•</span>
                <span className={styles.activeChannelTagline}>
                  {activeChannelConfig.tagline}
                </span>
              </div>
            </div>

            {/* Sliders list: strictly 0.00 to 1.00 with custom pointer engine */}
            <div className={styles.slidersList}>
              {activeChannelConfig.params.map((param) => {
                const key = `${selectedChannel}_${param.id}`;
                const val = channelParams[key] ?? param.defaultVal;
                return (
                  <CustomTrackSlider
                    key={key}
                    label={param.label}
                    tooltip={param.tooltip}
                    minLabel={param.minLabel}
                    maxLabel={param.maxLabel}
                    value={val}
                    onChange={(newVal) => handleParamChange(selectedChannel, param.id, newVal)}
                  />
                );
              })}
            </div>
          </div>

          {/* Right Column: Daily Preferences with Bespoke Popovers */}
          <GoalPreferences
            weeklyGoal={weeklyGoal}
            learningAllocation={learningAllocation}
            reminderWindow={reminderWindow}
            onWeeklyGoalChange={handleWeeklyGoalChange}
            onAllocationChange={handleAllocationChange}
            onReminderChange={handleReminderChange}
          />
        </div>
      )}
    </section>
  );
}
