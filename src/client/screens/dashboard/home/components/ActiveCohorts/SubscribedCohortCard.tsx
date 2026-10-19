'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, MoreVertical, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { ActiveCohort, Weekday } from '../../models';
import type { CohortLearningSettings } from './ActiveCohorts';
import styles from './SubscribedCohortCard.module.css';

export interface SubscribedCohortCardProps {
  cohort: ActiveCohort;
  onPause(until?: Date): void | Promise<void>;
  onResume(): void | Promise<void>;
  onSave(settings: CohortLearningSettings): Promise<void>;
  onDelete(): Promise<void>;
}

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80';
const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Panel = 'pause' | 'custom' | 'menu' | 'edit' | 'delete' | 'resume';

function localDateValue(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export const SubscribedCohortCard = React.memo(function SubscribedCohortCard({
  cohort, onPause, onResume, onSave, onDelete,
}: SubscribedCohortCardProps) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [imgError, setImgError] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [goal, setGoal] = useState(cohort.dailyGoalMinutes);
  const [days, setDays] = useState(cohort.schedule.days);
  const [order, setOrder] = useState(cohort.orderStyle || 'Sequential');
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const pauseButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const paused = Boolean(
    cohort.isPaused ||
    (cohort.pausedUntil && new Date(cohort.pausedUntil) > new Date()) ||
    cohort.resumeLabel === 'Paused'
  );
  const progress = Math.max(0, Math.min(100, cohort.progressPercent || 0));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const close = () => {
    setPanel(null);
    anchor.current?.focus();
  };
  const open = (next: Panel, button: HTMLButtonElement | null) => {
    anchor.current = button;
    setError('');
    setCustomDate('');
    setPanel(next);
    if (next === 'edit') {
      setGoal(cohort.dailyGoalMinutes);
      setDays(cohort.schedule.days);
      setOrder(cohort.orderStyle || 'Sequential');
    }
  };

  useLayoutEffect(() => {
    if (!panel) return;
    const updatePosition = () => {
      const button = anchor.current?.getBoundingClientRect();
      const popup = popover.current?.getBoundingClientRect();
      if (!button || !popup) return;
      const left = Math.max(12, Math.min(button.left, window.innerWidth - popup.width - 12));
      const below = button.bottom + 6;
      const top = below + popup.height <= window.innerHeight - 12
        ? below : Math.max(12, button.top - popup.height - 6);
      setPosition({ left, top });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    if (popover.current) observer.observe(popover.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [panel, error]);

  useEffect(() => {
    if (!panel) return;
    const focusTarget = panel === 'custom' ? dateInput.current
      : popover.current?.querySelector<HTMLElement>('[role="menuitem"], input, button:not([aria-label="Close options"])');
    focusTarget?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popover.current?.contains(target) && !pauseButton.current?.contains(target) && !menuButton.current?.contains(target)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
        anchor.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [panel]);

  const pauseForDays = (count: number) => {
    const until = new Date();
    until.setDate(until.getDate() + count);
    void persist(() => onPause(until));
  };
  const submitCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const selectedDate = dateInput.current?.value || customDate;
    if (!selectedDate || selectedDate < localDateValue(tomorrow)) {
      setError('Choose tomorrow or a later date.');
      return;
    }
    const [year, month, day] = selectedDate.split('-').map(Number);
    // Resume at the start of the following local day, covering the selected date.
    const until = new Date(year, month - 1, day + 1);
    void persist(() => onPause(until));
  };
  const persist = async (operation: () => void | Promise<void>) => {
    setPending(true);
    setError('');
    try { await operation(); close(); }
    catch {
      setError('Could not save this change. Please try again.');
      if (!panel) setPanel('resume');
    }
    finally { setPending(false); }
  };

  return (
    <article className={styles.card} data-paused={paused || undefined}>
      <div className={styles.imageWrapper}>
        <Image src={imgError || !cohort.thumbnail ? FALLBACK_COVER : cohort.thumbnail} alt="" fill
          sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1200px) 50vw, 260px"
          className={styles.image} onError={() => setImgError(true)} />
        <div className={styles.overlayGradient} />
      </div>
      <Link href={getCohortHref(cohort.cohortId || cohort.id)} className={styles.cardLink} aria-label={`Open ${cohort.title}`} />
      <div className={styles.statusControls}>
        <button ref={pauseButton} type="button" className={`${styles.iconButton} ${paused ? styles.pausedBtn : ''}`}
          data-paused={paused || undefined}
          aria-label={`${paused ? 'Resume' : 'Pause'} ${cohort.title}`}
          title={paused ? 'Resume' : 'Pause'}
          disabled={pending} onClick={() => {
            anchor.current = pauseButton.current;
            if (paused) {
              void persist(onResume);
            } else {
              void persist(() => onPause());
            }
          }}>
          {paused ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>
      <button ref={menuButton} type="button" className={styles.kebabBtn} aria-label={`Cohort actions for ${cohort.title}`}
        aria-expanded={panel === 'menu' || panel === 'edit' || panel === 'delete'} aria-haspopup="menu"
        onClick={() => panel === 'menu' ? close() : open('menu', menuButton.current)}><MoreVertical size={17} /></button>
      <div className={styles.bottomContent}>
        <h3 className={styles.title} title={cohort.title}>{cohort.title}</h3>
        <div className={styles.metaRow}>
          <span className={styles.memberCountText}>{cohort.provider}</span>
          <div className={styles.progressGroup}>
            <div className={styles.progressBarTrack} role="progressbar" aria-label={`Progress for ${cohort.title}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressBarFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressText}>{progress}%</span>
          </div>
        </div>
      </div>
      {panel && createPortal(
        <div ref={popover} className={styles.popover} style={position}
          role={panel === 'menu' ? 'menu' : 'dialog'} aria-label={`${panel === 'menu' ? 'Actions' : panel === 'edit' ? 'Learning settings' : panel === 'delete' ? 'Remove subscription' : 'Pause options'} for ${cohort.title}`}>
          {panel === 'menu' ? <>
            <button type="button" role="menuitem" onClick={() => open('edit', menuButton.current)}><Pencil size={14} /> Edit</button>
            <button type="button" role="menuitem" onClick={() => open('pause', menuButton.current)}><CalendarDays size={14} /> Pause options…</button>
            <button type="button" role="menuitem" className={styles.danger} onClick={() => open('delete', menuButton.current)}><Trash2 size={14} /> Delete</button>
          </> : <>
            <header className={styles.popoverHeader}>
              <strong>{panel === 'edit' ? 'Learning settings' : panel === 'delete' ? 'Remove subscription?' : panel === 'resume' ? 'Resume cohort' : 'Pause for'}</strong>
              <button type="button" className={styles.dismiss} aria-label="Close options" onClick={close}><X size={14} /></button>
            </header>
            {panel === 'pause' && <>
              <button type="button" disabled={pending} onClick={() => pauseForDays(1)}>1 day</button>
              <button type="button" disabled={pending} onClick={() => pauseForDays(7)}>1 week</button>
              <button type="button" disabled={pending} onClick={() => setPanel('custom')}><CalendarDays size={14} /> Custom date</button>
            </>}
            {panel === 'custom' && <form onSubmit={submitCustom} className={styles.form}>
              <label htmlFor={`pause-date-${cohort.id}`}>Pause through</label>
              <input ref={dateInput} id={`pause-date-${cohort.id}`} type="date" min={localDateValue(tomorrow)} value={customDate} required
                onClick={() => dateInput.current?.showPicker?.()} onInput={(event) => { setCustomDate(event.currentTarget.value); setError(''); }}
                onChange={(event) => { setCustomDate(event.target.value); setError(''); }} />
              <button type="submit" className={styles.primary} disabled={pending}>{pending ? 'Saving…' : 'Pause'}</button>
            </form>}
            {panel === 'edit' && <form className={styles.form} onSubmit={(event) => {
              event.preventDefault();
              void persist(() => onSave({ dailyGoalMinutes: goal, schedule: { days, label: days.length === 7 ? 'Everyday' : days.join(', ') }, orderStyle: order }));
            }}>
              <label htmlFor={`goal-${cohort.id}`}>Daily goal (minutes)</label>
              <input id={`goal-${cohort.id}`} type="number" min={5} max={180} required value={goal} onChange={(event) => setGoal(Number(event.target.value))} />
              <fieldset><legend>Learning days</legend><div className={styles.weekdays}>{WEEKDAYS.map((day) => <label key={day}>
                <input type="checkbox" checked={days.includes(day)} onChange={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />
                <span>{day}</span>
              </label>)}</div></fieldset>
              <label htmlFor={`order-${cohort.id}`}>Lesson order</label>
              <select id={`order-${cohort.id}`} value={order} onChange={(event) => setOrder(event.target.value as typeof order)}>
                <option>Sequential</option><option>Semantic Randomize</option><option>Randomize</option>
              </select>
              <button type="submit" className={styles.primary} disabled={pending || !days.length}>{pending ? 'Saving…' : 'Save changes'}</button>
            </form>}
            {panel === 'delete' && <>
              <p className={styles.helpText}>Remove this cohort from your subscribed list? Your progress will be kept.</p>
              <button type="button" className={styles.danger} disabled={pending} onClick={() => void persist(onDelete)}>{pending ? 'Removing…' : 'Remove subscription'}</button>
              <button type="button" disabled={pending} onClick={close}>Cancel</button>
            </>}
          </>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>, document.body,
      )}
    </article>
  );
});
