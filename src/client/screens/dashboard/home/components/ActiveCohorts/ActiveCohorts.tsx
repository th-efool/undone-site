'use client';

import React, { useMemo, useState } from 'react';
import { Pause, X } from 'lucide-react';
import type { ActiveCohort, HomeSectionContent } from '../../models';
import { SubscribedCohortCard } from './SubscribedCohortCard';
import styles from './ActiveCohorts.module.css';

export interface ActiveCohortsProps { heading: HomeSectionContent; items: ActiveCohort[]; onPause(cohortId: string, pausedUntil: Date, pausedReason?: string): void; onResume(cohortId: string): void; }
const PRESETS = [{ label: 'Tomorrow', hours: 24 }, { label: '1 week', hours: 168 }, { label: '1 month', hours: 720 }];

export const ActiveCohorts = React.memo(function ActiveCohorts({ heading, items, onPause, onResume }: ActiveCohortsProps) {
  const [pauseTarget, setPauseTarget] = useState<ActiveCohort | null>(null);
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const visibleItems = useMemo(() => items.filter((item) => !item.pausedUntil || new Date(item.pausedUntil) > new Date()), [items]);
  const pauseFor = (hours: number) => { if (!pauseTarget) return; onPause(pauseTarget.cohortId || pauseTarget.id, new Date(Date.now() + hours * 3_600_000)); setPauseTarget(null); };
  const submitCustomPause = (event: React.FormEvent) => {
    event.preventDefault(); const date = new Date(until);
    if (!until || Number.isNaN(date.getTime()) || date <= new Date()) { setError('Choose a future date and time.'); return; }
    if (pauseTarget) onPause(pauseTarget.cohortId || pauseTarget.id, date); setPauseTarget(null);
  };
  return <section className={styles.section} aria-label={heading.title || 'Subscribed Cohorts'}>
    <div className={styles.sectionHeader}><h2 className={styles.title}>{heading.title || 'Subscribed Cohorts'}</h2></div>
    <div className={styles.grid}>{visibleItems.map((cohort) => <SubscribedCohortCard key={cohort.id} cohort={cohort} onPause={() => { setPauseTarget(cohort); setUntil(''); setError(''); }} onResume={() => onResume(cohort.cohortId || cohort.id)} />)}</div>
    {pauseTarget && <div className={styles.pauseDialogBackdrop} role="presentation" onMouseDown={() => setPauseTarget(null)}>
      <form className={styles.pauseDialog} onSubmit={submitCustomPause} onMouseDown={(event) => event.stopPropagation()} aria-labelledby="pause-cohort-title">
        <button className={styles.closeDialog} type="button" aria-label="Close pause dialog" onClick={() => setPauseTarget(null)}><X size={18} /></button><Pause size={20} aria-hidden="true" />
        <h3 id="pause-cohort-title">Pause {pauseTarget.title}</h3><p>Choose when it should return to your learning plan.</p>
        <div className={styles.pausePresets}>{PRESETS.map((preset) => <button type="button" key={preset.label} onClick={() => pauseFor(preset.hours)}>{preset.label}</button>)}</div>
        <label htmlFor="pause-until">Custom date and time</label><input id="pause-until" type="datetime-local" value={until} onChange={(event) => { setUntil(event.target.value); setError(''); }} />
        {error && <p className={styles.pauseError} role="alert">{error}</p>}<button className={styles.confirmPause} type="submit">Pause until this time</button>
      </form>
    </div>}
  </section>;
});
