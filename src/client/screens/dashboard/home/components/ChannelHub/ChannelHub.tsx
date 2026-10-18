'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import styles from './ChannelHub.module.css';

// ─── Data & Types ────────────────────────────────────────────────────────────

export type ChannelId = 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

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

function TuningSlider({
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

      <div className={styles.sliderTrackWrapper}>
        <div
          className={styles.sliderProgressFill}
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={styles.sliderInput}
          aria-label={label}
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
}

export function ChannelHub() {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('sidequest_finetune_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [selectedChannel, setSelectedChannel] = useState<ChannelId>(() => {
    if (typeof window === 'undefined') return 'spark';
    try {
      const saved = localStorage.getItem('sidequest_active_channel') as ChannelId;
      return saved && CHANNELS.some((c) => c.id === saved) ? saved : 'spark';
    } catch {
      return 'spark';
    }
  });

  const [depth, setDepth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SLIDERS.depth;
    try {
      const raw = localStorage.getItem('sidequest_pref_depth');
      const parsed = raw ? parseFloat(raw) : NaN;
      return !isNaN(parsed) ? parsed : DEFAULT_SLIDERS.depth;
    } catch {
      return DEFAULT_SLIDERS.depth;
    }
  });

  const [rigor, setRigor] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SLIDERS.rigor;
    try {
      const raw = localStorage.getItem('sidequest_pref_rigor');
      const parsed = raw ? parseFloat(raw) : NaN;
      return !isNaN(parsed) ? parsed : DEFAULT_SLIDERS.rigor;
    } catch {
      return DEFAULT_SLIDERS.rigor;
    }
  });

  const [scaffolding, setScaffolding] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SLIDERS.scaffolding;
    try {
      const raw = localStorage.getItem('sidequest_pref_scaffolding');
      const parsed = raw ? parseFloat(raw) : NaN;
      return !isNaN(parsed) ? parsed : DEFAULT_SLIDERS.scaffolding;
    } catch {
      return DEFAULT_SLIDERS.scaffolding;
    }
  });

  const [weeklyGoal, setWeeklyGoal] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS.weeklyGoal;
    try {
      return localStorage.getItem('sidequest_pref_weekly_goal') || DEFAULT_PREFS.weeklyGoal;
    } catch {
      return DEFAULT_PREFS.weeklyGoal;
    }
  });

  const [learningAllocation, setLearningAllocation] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS.learningAllocation;
    try {
      return localStorage.getItem('sidequest_pref_learning_allocation') || DEFAULT_PREFS.learningAllocation;
    } catch {
      return DEFAULT_PREFS.learningAllocation;
    }
  });

  const [reminderWindow, setReminderWindow] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS.reminderWindow;
    try {
      return localStorage.getItem('sidequest_pref_reminder_window') || DEFAULT_PREFS.reminderWindow;
    } catch {
      return DEFAULT_PREFS.reminderWindow;
    }
  });

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSyncConfig = (
    channelId: ChannelId,
    prefsMap: Record<string, string>,
  ) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/user/channel-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeChannel: channelId, prefs: prefsMap }),
      }).catch(() => {});
    }, 800);
  };

  // Hydrate preferences from remote database on mount
  useEffect(() => {
    async function loadRemoteConfig() {
      try {
        const res = await fetch('/api/user/channel-config');
        if (res.ok) {
          const data = await res.json();
          if (data.activeChannel && CHANNELS.some((c) => c.id === data.activeChannel)) {
            setSelectedChannel(data.activeChannel);
          }
          if (data.prefs && typeof data.prefs === 'object') {
            if (data.prefs.depth) setDepth(parseFloat(data.prefs.depth));
            if (data.prefs.rigor) setRigor(parseFloat(data.prefs.rigor));
            if (data.prefs.scaffolding) setScaffolding(parseFloat(data.prefs.scaffolding));
            if (data.prefs.weekly_goal) setWeeklyGoal(data.prefs.weekly_goal);
            if (data.prefs.learning_allocation) setLearningAllocation(data.prefs.learning_allocation);
            if (data.prefs.reminder_window) setReminderWindow(data.prefs.reminder_window);
          }
        }
      } catch (err) {
        console.warn('Failed to load remote channel config:', err);
      }
    }
    loadRemoteConfig();
  }, []);

  const savePreferences = (
    channelId: ChannelId,
    d: number,
    r: number,
    s: number,
    wg: string,
    la: string,
    rw: string,
  ) => {
    const prefsMap: Record<string, string> = {
      depth: d.toFixed(2),
      rigor: r.toFixed(2),
      scaffolding: s.toFixed(2),
      weekly_goal: wg,
      learning_allocation: la,
      reminder_window: rw,
    };

    try {
      localStorage.setItem('sidequest_active_channel', channelId);
      localStorage.setItem('sidequest_pref_depth', d.toFixed(2));
      localStorage.setItem('sidequest_pref_rigor', r.toFixed(2));
      localStorage.setItem('sidequest_pref_scaffolding', s.toFixed(2));
      localStorage.setItem('sidequest_pref_weekly_goal', wg);
      localStorage.setItem('sidequest_pref_learning_allocation', la);
      localStorage.setItem('sidequest_pref_reminder_window', rw);
      localStorage.setItem('sidequest_channel_prefs', JSON.stringify(prefsMap));
    } catch {}

    debouncedSyncConfig(channelId, prefsMap);
  };

  const handleChannelSelect = (id: ChannelId) => {
    setSelectedChannel(id);
    savePreferences(id, depth, rigor, scaffolding, weeklyGoal, learningAllocation, reminderWindow);
  };

  const handleDepthChange = (val: number) => {
    setDepth(val);
    savePreferences(selectedChannel, val, rigor, scaffolding, weeklyGoal, learningAllocation, reminderWindow);
  };

  const handleRigorChange = (val: number) => {
    setRigor(val);
    savePreferences(selectedChannel, depth, val, scaffolding, weeklyGoal, learningAllocation, reminderWindow);
  };

  const handleScaffoldingChange = (val: number) => {
    setScaffolding(val);
    savePreferences(selectedChannel, depth, rigor, val, weeklyGoal, learningAllocation, reminderWindow);
  };

  const handleWeeklyGoalChange = (val: string) => {
    setWeeklyGoal(val);
    savePreferences(selectedChannel, depth, rigor, scaffolding, val, learningAllocation, reminderWindow);
  };

  const handleAllocationChange = (val: string) => {
    setLearningAllocation(val);
    savePreferences(selectedChannel, depth, rigor, scaffolding, weeklyGoal, val, reminderWindow);
  };

  const handleReminderChange = (val: string) => {
    setReminderWindow(val);
    savePreferences(selectedChannel, depth, rigor, scaffolding, weeklyGoal, learningAllocation, val);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedChannel('spark');
    setDepth(DEFAULT_SLIDERS.depth);
    setRigor(DEFAULT_SLIDERS.rigor);
    setScaffolding(DEFAULT_SLIDERS.scaffolding);
    setWeeklyGoal(DEFAULT_PREFS.weeklyGoal);
    setLearningAllocation(DEFAULT_PREFS.learningAllocation);
    setReminderWindow(DEFAULT_PREFS.reminderWindow);

    savePreferences(
      'spark',
      DEFAULT_SLIDERS.depth,
      DEFAULT_SLIDERS.rigor,
      DEFAULT_SLIDERS.scaffolding,
      DEFAULT_PREFS.weeklyGoal,
      DEFAULT_PREFS.learningAllocation,
      DEFAULT_PREFS.reminderWindow,
    );
  };

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidequest_finetune_expanded', String(next));
      } catch {}
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
              {CHANNELS.map((ch) => {
                const isActive = ch.id === selectedChannel;
                const IconComponent = ch.Icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.iconTab} ${isActive ? styles.iconTabActive : ''}`}
                    onClick={() => handleChannelSelect(ch.id)}
                    title={`${ch.name} — ${ch.tagline}`}
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
