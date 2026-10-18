'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mountain,
  FileText,
  Headphones,
  Pencil,
  Compass,
  Box,
  Clock,
  BarChart2,
  Bell,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  HelpCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  homeStorageAdapter,
  DEFAULT_CHANNEL_PREFERENCES,
  type ChannelId,
} from '@/src/client/repositories/homeStorageAdapter';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

// ─── Data & Types ────────────────────────────────────────────────────────────

export type { ChannelId } from '@/src/client/repositories/homeStorageAdapter';

export interface LearningStyle {
  id: ChannelId;
  name: string;
  Icon: React.ElementType;
  tagline: string;
}

export const CHANNELS: LearningStyle[] = [
  { id: 'spark', name: 'Visual & Conceptual', Icon: Mountain, tagline: 'Visual diagrams, spatial analogies, and imagery' },
  { id: 'deep_dive', name: 'Deep Reading & Text', Icon: FileText, tagline: 'Structured text, deep rigor, and detailed prose' },
  { id: 'listen', name: 'Audio & Conversations', Icon: Headphones, tagline: 'Narrated walkthroughs, dialogues, and audio sessions' },
  { id: 'build', name: 'Hands-on & Practice', Icon: Pencil, tagline: 'Interactive exercises, code, and active practice' },
  { id: 'explore', name: 'Broad Exploration', Icon: Compass, tagline: 'Interdisciplinary links and wandering curiosities' },
  { id: 'quick', name: 'Mental Models & Systems', Icon: Box, tagline: 'System architectures, 3D structures, and fast takeaways' },
];

const DEFAULT_SLIDERS = {
  depth: 3.74,
  rigor: 2.48,
  scaffolding: 1.0,
};

const DEFAULT_PREFS = {
  weeklyGoal: '8 hours',
  learningAllocation: 'Balanced',
  reminderWindow: 'Evening',
};

interface TuningSliderProps {
  label: string;
  tooltip: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const TuningSlider = React.memo(function TuningSlider({
  label,
  tooltip,
  value,
  min = 0,
  max = 5,
  step = 0.01,
  onChange,
}: TuningSliderProps) {
  const percentage = Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));

  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderLabelGroup}>
        <span className={styles.sliderName}>{label}</span>
        <span className={styles.sliderHelp} title={tooltip} aria-label={tooltip}>
          <HelpCircle size={13} strokeWidth={2} />
        </span>
      </div>

      <div
        className={styles.sliderTrackWrapper}
        style={{ '--slider-fill': `${percentage}%` } as React.CSSProperties}
      >
        <div className={styles.sliderProgressFill} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.sliderInput}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${label}: ${value.toFixed(2)}`}
        />
      </div>

      <div className={styles.sliderValueBadge}>
        <span className={styles.plusBox}>
          <span className={styles.plusSign}>+</span>
        </span>
        <span className={styles.valueNumber}>{value.toFixed(2)}</span>
      </div>
    </div>
  );
});

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

export function ChannelHub() {
  const { data: session, status: authStatus } = useSafeSession();
  const isAuthenticated = authStatus === 'authenticated' && !!session?.user?.id;

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>('spark');
  const [depth, setDepth] = useState<number>(DEFAULT_SLIDERS.depth);
  const [rigor, setRigor] = useState<number>(DEFAULT_SLIDERS.rigor);
  const [scaffolding, setScaffolding] = useState<number>(DEFAULT_SLIDERS.scaffolding);
  const [weeklyGoal, setWeeklyGoal] = useState<string>(DEFAULT_PREFS.weeklyGoal);
  const [learningAllocation, setLearningAllocation] = useState<string>(DEFAULT_PREFS.learningAllocation);
  const [reminderWindow, setReminderWindow] = useState<string>(DEFAULT_PREFS.reminderWindow);

  const stateRef = useRef({
    selectedChannel,
    depth,
    rigor,
    scaffolding,
    weeklyGoal,
    learningAllocation,
    reminderWindow,
  });

  useEffect(() => {
    stateRef.current = {
      selectedChannel,
      depth,
      rigor,
      scaffolding,
      weeklyGoal,
      learningAllocation,
      reminderWindow,
    };
  });

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced persistence for localStorage and backend sync
  const schedulePersistence = useCallback(
    (
      channelId: ChannelId,
      d: number,
      r: number,
      s: number,
      wg: string,
      la: string,
      rw: string,
      immediate = false,
    ) => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }

      const commit = () => {
        homeStorageAdapter.saveSelectedChannel(channelId);
        homeStorageAdapter.saveChannelPreferences({
          depth: d,
          rigor: r,
          scaffolding: s,
          weeklyGoal: wg,
          learningAllocation: la,
          reminderWindow: rw,
        });

        // Only sync to remote backend if authenticated
        if (isAuthenticated) {
          const prefsMap: Record<string, string> = {
            depth: d.toFixed(2),
            rigor: r.toFixed(2),
            scaffolding: s.toFixed(2),
            weekly_goal: wg,
            learning_allocation: la,
            reminder_window: rw,
          };

          fetch('/api/user/channel-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeChannel: channelId, prefs: prefsMap }),
          }).catch((err) => {
            console.warn('[ChannelHub] Network error syncing channel config:', err);
          });
        }
      };

      if (immediate) {
        commit();
      } else {
        persistTimerRef.current = setTimeout(commit, 400);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  // Hydrate preferences from localStorage and remote database on mount (SSR-safe)
  useEffect(() => {
    try {
      setIsExpanded(homeStorageAdapter.getChannelHubExpanded());

      const urlChannel = getInitialChannelFromUrl();
      if (urlChannel) {
        setSelectedChannel(urlChannel);
        homeStorageAdapter.saveSelectedChannel(urlChannel);
      } else {
        const storedChannel = homeStorageAdapter.getSelectedChannel();
        if (storedChannel && CHANNELS.some((c) => c.id === storedChannel)) {
          setSelectedChannel(storedChannel);
        }
      }

      const storedPrefs = homeStorageAdapter.getChannelPreferences();
      setDepth(storedPrefs.depth);
      setRigor(storedPrefs.rigor);
      setScaffolding(storedPrefs.scaffolding);
      setWeeklyGoal(storedPrefs.weeklyGoal);
      setLearningAllocation(storedPrefs.learningAllocation);
      setReminderWindow(storedPrefs.reminderWindow);
    } catch {}

    const onPopState = () => {
      const poppedChannel = getInitialChannelFromUrl();
      if (poppedChannel) {
        setSelectedChannel(poppedChannel);
        homeStorageAdapter.saveSelectedChannel(poppedChannel);
      }
    };
    window.addEventListener('popstate', onPopState);

    async function loadRemoteConfig() {
      try {
        const res = await fetch('/api/user/channel-config');
        if (res.ok) {
          const data = await res.json();
          const currentUrlChannel = getInitialChannelFromUrl();
          if (!currentUrlChannel && data.activeChannel && CHANNELS.some((c) => c.id === data.activeChannel)) {
            setSelectedChannel(data.activeChannel);
            homeStorageAdapter.saveSelectedChannel(data.activeChannel);
          }
          if (data.prefs && typeof data.prefs === 'object') {
            const nextPrefs: Partial<import('@/src/client/repositories/homeStorageAdapter').ChannelPreferences> = {};
            if (data.prefs.depth && !isNaN(parseFloat(data.prefs.depth))) {
              const d = parseFloat(data.prefs.depth);
              setDepth(d);
              nextPrefs.depth = d;
            }
            if (data.prefs.rigor && !isNaN(parseFloat(data.prefs.rigor))) {
              const r = parseFloat(data.prefs.rigor);
              setRigor(r);
              nextPrefs.rigor = r;
            }
            if (data.prefs.scaffolding && !isNaN(parseFloat(data.prefs.scaffolding))) {
              const s = parseFloat(data.prefs.scaffolding);
              setScaffolding(s);
              nextPrefs.scaffolding = s;
            }
            if (data.prefs.weekly_goal) {
              setWeeklyGoal(data.prefs.weekly_goal);
              nextPrefs.weeklyGoal = data.prefs.weekly_goal;
            }
            if (data.prefs.learning_allocation) {
              setLearningAllocation(data.prefs.learning_allocation);
              nextPrefs.learningAllocation = data.prefs.learning_allocation;
            }
            if (data.prefs.reminder_window) {
              setReminderWindow(data.prefs.reminder_window);
              nextPrefs.reminderWindow = data.prefs.reminder_window;
            }
            homeStorageAdapter.saveChannelPreferences(nextPrefs);
          }
        }
      } catch (err) {
        console.warn('Failed to load remote channel config:', err);
      }
    }

    if (isAuthenticated) {
      loadRemoteConfig();
    }

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isAuthenticated]);

  const handleChannelSelect = useCallback((id: ChannelId) => {
    setSelectedChannel(id);
    syncChannelUrlParam(id);
    const s = stateRef.current;
    schedulePersistence(id, s.depth, s.rigor, s.scaffolding, s.weeklyGoal, s.learningAllocation, s.reminderWindow, true);
  }, [schedulePersistence]);

  const handleDepthChange = useCallback((val: number) => {
    setDepth(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, val, s.rigor, s.scaffolding, s.weeklyGoal, s.learningAllocation, s.reminderWindow, false);
  }, [schedulePersistence]);

  const handleRigorChange = useCallback((val: number) => {
    setRigor(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, s.depth, val, s.scaffolding, s.weeklyGoal, s.learningAllocation, s.reminderWindow, false);
  }, [schedulePersistence]);

  const handleScaffoldingChange = useCallback((val: number) => {
    setScaffolding(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, s.depth, s.rigor, val, s.weeklyGoal, s.learningAllocation, s.reminderWindow, false);
  }, [schedulePersistence]);

  const handleWeeklyGoalChange = useCallback((val: string) => {
    setWeeklyGoal(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, s.depth, s.rigor, s.scaffolding, val, s.learningAllocation, s.reminderWindow, true);
  }, [schedulePersistence]);

  const handleAllocationChange = useCallback((val: string) => {
    setLearningAllocation(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, s.depth, s.rigor, s.scaffolding, s.weeklyGoal, val, s.reminderWindow, true);
  }, [schedulePersistence]);

  const handleReminderChange = useCallback((val: string) => {
    setReminderWindow(val);
    const s = stateRef.current;
    schedulePersistence(s.selectedChannel, s.depth, s.rigor, s.scaffolding, s.weeklyGoal, s.learningAllocation, val, true);
  }, [schedulePersistence]);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetIndex = (index + 1) % CHANNELS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      targetIndex = (index - 1 + CHANNELS.length) % CHANNELS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetIndex = CHANNELS.length - 1;
    }

    if (targetIndex !== -1) {
      const nextChannel = CHANNELS[targetIndex];
      handleChannelSelect(nextChannel.id);
      tabRefs.current[targetIndex]?.focus();
    }
  }, [handleChannelSelect]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedChannel('spark');
    syncChannelUrlParam('spark');
    setDepth(DEFAULT_SLIDERS.depth);
    setRigor(DEFAULT_SLIDERS.rigor);
    setScaffolding(DEFAULT_SLIDERS.scaffolding);
    setWeeklyGoal(DEFAULT_PREFS.weeklyGoal);
    setLearningAllocation(DEFAULT_PREFS.learningAllocation);
    setReminderWindow(DEFAULT_PREFS.reminderWindow);

    schedulePersistence(
      'spark',
      DEFAULT_SLIDERS.depth,
      DEFAULT_SLIDERS.rigor,
      DEFAULT_SLIDERS.scaffolding,
      DEFAULT_PREFS.weeklyGoal,
      DEFAULT_PREFS.learningAllocation,
      DEFAULT_PREFS.reminderWindow,
      true,
    );
  }, [schedulePersistence]);

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      homeStorageAdapter.saveChannelHubExpanded(next);
      return next;
    });
  };

  return (
    <section className={styles.card} aria-label="Fine-tune your feed">
      {/* Collapsible Card Header */}
      <div
        className={styles.header}
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
          }
        }}
        aria-expanded={isExpanded}
      >
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge}>
            <SlidersHorizontal size={15} strokeWidth={2.4} />
          </div>
          <div className={styles.headerTitles}>
            <div className={styles.headerTitleRow}>
              <h2 className={styles.title}>Fine-tune your feed</h2>
              <span className={styles.chevronIcon} aria-hidden="true">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </div>
            <p className={styles.subtitle}>
              Adjust how the feed curates and adapts to you. You can change this anytime.
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
            title="Reset feed adjustments to defaults"
            aria-label="Reset adjustments to defaults"
          >
            <RotateCcw size={13} strokeWidth={2.2} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Expanded Tuning Body */}
      {isExpanded && (
        <div className={styles.bodyGrid}>
          {/* Left Column: Learning Style & Sliders */}
          <div className={styles.colSection}>
            <div className={styles.sectionHeadingRow}>
              <span className={styles.sectionHeading}>Learning style</span>
            </div>

            {/* 6 Icon Tabs */}
            <div className={styles.iconTabsRow} role="tablist" aria-label="Learning Styles">
              {CHANNELS.map((ch, idx) => {
                const isActive = ch.id === selectedChannel;
                const IconComponent = ch.Icon;
                return (
                  <button
                    key={ch.id}
                    ref={(el) => { tabRefs.current[idx] = el; }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`${styles.iconTab} ${isActive ? styles.iconTabActive : ''}`}
                    onClick={() => handleChannelSelect(ch.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    title={`${ch.name} — ${ch.tagline}`}
                    aria-label={`${ch.name}: ${ch.tagline}`}
                  >
                    <IconComponent size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  </button>
                );
              })}
            </div>

            {/* 3 Parameter Sliders */}
            <div className={styles.slidersList}>
              <TuningSlider
                label="Depth"
                tooltip="Adjust conceptual depth from practical overview to first principles"
                value={depth}
                onChange={handleDepthChange}
              />
              <TuningSlider
                label="Rigor"
                tooltip="Adjust pedagogical rigor from intuitive analogies to formal explanations"
                value={rigor}
                onChange={handleRigorChange}
              />
              <TuningSlider
                label="Scaffolding"
                tooltip="Adjust guidance level from step-by-step handholding to independent challenges"
                value={scaffolding}
                onChange={handleScaffoldingChange}
              />
            </div>
          </div>

          {/* Right Column: Daily Preferences */}
          <div className={styles.colSection}>
            <div className={styles.sectionHeadingRow}>
              <span className={styles.sectionHeading}>Daily preferences</span>
            </div>

            <div className={styles.prefList}>
              {/* Row 1: Weekly learning goal */}
              <div className={styles.prefRow}>
                <div className={styles.prefIconWrapper}>
                  <Clock size={16} strokeWidth={2} />
                </div>
                <div className={styles.prefTextGroup}>
                  <span className={styles.prefTitle}>Weekly learning goal</span>
                  <span className={styles.prefDesc}>Measure progress against your commitment</span>
                </div>
                <div className={styles.selectWrapper}>
                  <div className={styles.customSelectTrigger}>
                    <Clock size={13} strokeWidth={2} className={styles.selectIcon} />
                    <span className={styles.selectLabel}>{weeklyGoal}</span>
                    <ChevronDown size={13} className={styles.selectChevron} aria-hidden="true" />
                  </div>
                  <select
                    value={weeklyGoal}
                    onChange={(e) => handleWeeklyGoalChange(e.target.value)}
                    className={styles.hiddenSelectInput}
                    aria-label="Weekly learning goal"
                  >
                    <option value="4 hours">4 hours</option>
                    <option value="6 hours">6 hours</option>
                    <option value="8 hours">8 hours</option>
                    <option value="10 hours">10 hours</option>
                    <option value="12 hours">12 hours</option>
                    <option value="15 hours">15 hours</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Learning allocation */}
              <div className={styles.prefRow}>
                <div className={styles.prefIconWrapper}>
                  <BarChart2 size={16} strokeWidth={2} />
                </div>
                <div className={styles.prefTextGroup}>
                  <span className={styles.prefTitle}>Learning allocation</span>
                  <span className={styles.prefDesc}>Balance backlog, exploration, and depth</span>
                </div>
                <div className={styles.selectWrapper}>
                  <div className={styles.customSelectTrigger}>
                    <BarChart2 size={13} strokeWidth={2} className={styles.selectIcon} />
                    <span className={styles.selectLabel}>{learningAllocation}</span>
                    <ChevronDown size={13} className={styles.selectChevron} aria-hidden="true" />
                  </div>
                  <select
                    value={learningAllocation}
                    onChange={(e) => handleAllocationChange(e.target.value)}
                    className={styles.hiddenSelectInput}
                    aria-label="Learning allocation"
                  >
                    <option value="Balanced">Balanced</option>
                    <option value="Deep Dive">Deep Dive</option>
                    <option value="Exploratory">Exploratory</option>
                    <option value="Sprint">Sprint</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Reminder window */}
              <div className={styles.prefRow}>
                <div className={styles.prefIconWrapper}>
                  <Bell size={16} strokeWidth={2} />
                </div>
                <div className={styles.prefTextGroup}>
                  <span className={styles.prefTitle}>Reminder window</span>
                  <span className={styles.prefDesc}>Choose when reminders arrive</span>
                </div>
                <div className={styles.selectWrapper}>
                  <div className={styles.customSelectTrigger}>
                    <Bell size={13} strokeWidth={2} className={styles.selectIcon} />
                    <span className={styles.selectLabel}>{reminderWindow}</span>
                    <ChevronDown size={13} className={styles.selectChevron} aria-hidden="true" />
                  </div>
                  <select
                    value={reminderWindow}
                    onChange={(e) => handleReminderChange(e.target.value)}
                    className={styles.hiddenSelectInput}
                    aria-label="Reminder window"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
