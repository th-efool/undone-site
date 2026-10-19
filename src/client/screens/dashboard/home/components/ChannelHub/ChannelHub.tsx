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
  DEFAULT_CHANNEL_PREFERENCES,
  type ChannelId,
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
  const percent = Math.round(clampedValue * 100);

  const updateFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawRatio = (clientX - rect.left) / rect.width;
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
            style={{ width: `${percent}%` }}
          />
          {/* Custom thumb */}
          <div
            className={styles.sliderThumb}
            style={{ left: `${percent}%` }}
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
}

function CustomDropdown({ label, icon, value, options, onChange }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  return (
    <div className={styles.dailyPrefRow} ref={containerRef}>
      <div className={styles.dailyPrefLabel}>
        {icon}
        <span>{label}</span>
      </div>

      <div className={styles.dropdownContainer}>
        <button
          type="button"
          className={`${styles.customDropdownBtn} ${isOpen ? styles.dropdownBtnActive : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={styles.dropdownValueText}>{value}</span>
          <ChevronDown
            size={14}
            className={`${styles.dropdownChevron} ${isOpen ? styles.chevronOpen : ''}`}
          />
        </button>

        {isOpen && (
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
}

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
  const isAuthenticated = authStatus === 'authenticated' && !!session?.user?.id;

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('spark');

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

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate state from localStorage on mount
  useEffect(() => {
    setIsExpanded(homeStorageAdapter.getChannelHubExpanded());

    const urlChannel = getInitialChannelFromUrl();
    const storedChannel = urlChannel || homeStorageAdapter.getSelectedChannel();
    setSelectedChannel(storedChannel);

    const storedPrefs = homeStorageAdapter.getChannelPreferences();
    if (storedPrefs.weeklyGoal) setWeeklyGoal(storedPrefs.weeklyGoal);
    if (storedPrefs.learningAllocation) setLearningAllocation(storedPrefs.learningAllocation);
    if (storedPrefs.reminderWindow) setReminderWindow(storedPrefs.reminderWindow);

    // Hydrate each channel's dedicated parameters
    const nextParams: Record<string, number> = {};
    for (const ch of CHANNELS) {
      for (const p of ch.params) {
        const val = homeStorageAdapter.getChannelParam(ch.id, p.id, p.defaultVal);
        nextParams[`${ch.id}_${p.id}`] = val;
      }
    }
    setChannelParams(nextParams);

    // Sync with backend if authenticated
    if (isAuthenticated) {
      homeStorageAdapter.syncChannelWithBackend(true).then((res) => {
        if (res?.prefs) {
          if (res.prefs.weeklyGoal) setWeeklyGoal(res.prefs.weeklyGoal);
          if (res.prefs.learningAllocation) setLearningAllocation(res.prefs.learningAllocation);
          if (res.prefs.reminderWindow) setReminderWindow(res.prefs.reminderWindow);
        }
      });
    }

    const onPopState = () => {
      const popped = getInitialChannelFromUrl();
      if (popped) {
        setSelectedChannel(popped);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isAuthenticated]);

  // Debounced backend sync
  const scheduleBackendSync = useCallback(
    (
      channelId: ChannelId,
      allParams: Record<string, number>,
      goal: string,
      alloc: string,
      reminder: string,
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(async () => {
        if (!isAuthenticated) return;
        try {
          const prefsPayload: Record<string, string> = {
            weekly_goal: goal,
            learning_allocation: alloc,
            reminder_window: reminder,
          };
          for (const [k, v] of Object.entries(allParams)) {
            prefsPayload[k] = v.toFixed(2);
          }
          await fetch('/api/user/channel-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activeChannel: channelId,
              prefs: prefsPayload,
            }),
          });
        } catch (err) {
          console.warn('ChannelHub backend sync failure:', err);
        }
      }, 500);
    },
    [isAuthenticated],
  );

  const handleToggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      homeStorageAdapter.saveChannelHubExpanded(next);
      return next;
    });
  };

  const handleChannelSelect = (channelId: ChannelId) => {
    setSelectedChannel(channelId);
    homeStorageAdapter.saveSelectedChannel(channelId);
    syncChannelUrlParam(channelId);
    scheduleBackendSync(channelId, channelParams, weeklyGoal, learningAllocation, reminderWindow);
  };

  const handleParamChange = (channelId: ChannelId, paramId: string, val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    const key = `${channelId}_${paramId}`;
    setChannelParams((prev) => {
      const next = { ...prev, [key]: clamped };
      homeStorageAdapter.saveChannelParam(channelId, paramId, clamped);
      scheduleBackendSync(selectedChannel, next, weeklyGoal, learningAllocation, reminderWindow);
      return next;
    });
  };

  const handleWeeklyGoalChange = (newGoal: string) => {
    setWeeklyGoal(newGoal);
    homeStorageAdapter.saveChannelPreferences({ weeklyGoal: newGoal });
    scheduleBackendSync(selectedChannel, channelParams, newGoal, learningAllocation, reminderWindow);
  };

  const handleAllocationChange = (newAlloc: string) => {
    setLearningAllocation(newAlloc);
    homeStorageAdapter.saveChannelPreferences({ learningAllocation: newAlloc });
    scheduleBackendSync(selectedChannel, channelParams, weeklyGoal, newAlloc, reminderWindow);
  };

  const handleReminderChange = (newReminder: string) => {
    setReminderWindow(newReminder);
    homeStorageAdapter.saveChannelPreferences({ reminderWindow: newReminder });
    scheduleBackendSync(selectedChannel, channelParams, weeklyGoal, learningAllocation, newReminder);
  };

  const handleReset = () => {
    const activeCh = CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0];
    setChannelParams((prev) => {
      const next = { ...prev };
      for (const p of activeCh.params) {
        next[`${activeCh.id}_${p.id}`] = p.defaultVal;
        homeStorageAdapter.saveChannelParam(activeCh.id, p.id, p.defaultVal);
      }
      return next;
    });
    setWeeklyGoal(DEFAULT_PREFS.weeklyGoal);
    setLearningAllocation(DEFAULT_PREFS.learningAllocation);
    setReminderWindow(DEFAULT_PREFS.reminderWindow);

    homeStorageAdapter.saveChannelPreferences({
      weeklyGoal: DEFAULT_PREFS.weeklyGoal,
      learningAllocation: DEFAULT_PREFS.learningAllocation,
      reminderWindow: DEFAULT_PREFS.reminderWindow,
    });
  };

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
            <div
              className={styles.iconTabsRow}
              role="tablist"
              aria-label="Select learning style"
            >
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
                    onClick={() => handleChannelSelect(ch.id)}
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
          <div className={styles.rightCol}>
            <div className={styles.subheadRow}>
              <span className={styles.subhead}>Daily preferences</span>
            </div>

            <div className={styles.dailyPrefsList}>
              <CustomDropdown
                label="Weekly learning goal"
                icon={<Clock size={15} className={styles.prefIcon} />}
                value={weeklyGoal}
                options={['4 hours', '6 hours', '8 hours', '12 hours', '16 hours']}
                onChange={handleWeeklyGoalChange}
              />

              <CustomDropdown
                label="Learning allocation"
                icon={<BarChart2 size={15} className={styles.prefIcon} />}
                value={learningAllocation}
                options={['Focused', 'Balanced', 'Exploratory', 'Intense']}
                onChange={handleAllocationChange}
              />

              <CustomDropdown
                label="Reminder window"
                icon={<Bell size={15} className={styles.prefIcon} />}
                value={reminderWindow}
                options={['Morning', 'Afternoon', 'Evening', 'Night', 'None']}
                onChange={handleReminderChange}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
