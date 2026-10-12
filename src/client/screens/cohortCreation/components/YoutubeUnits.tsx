'use client';
import { useRef, useState } from 'react';
import { YoutubeThumbnail } from './YoutubeThumbnail';
import styles from './YoutubeUnits.module.css';

export function YoutubeUnits({ units, selected, disabled, onSave, onPrepare, maxSelected = 100 }: {
  units: { unitId: string; title: string; durationSeconds: number }[]; selected: string[]; disabled: boolean;
  onSave: (ids: string[]) => Promise<boolean>;
  onPrepare?: () => Promise<boolean>;
  maxSelected?: number;
}) {
  const [choice, setChoice] = useState(() => new Set(selected.length ? selected : onPrepare && units.length === 1 && maxSelected > 0 ? [units[0].unitId] : [])); const [saving, setSaving] = useState(false);
  const pending = useRef(false); const [error, setError] = useState<string | null>(null);
  return <form aria-label="Video scope" onSubmit={async event => {
    event.preventDefault(); if (disabled || pending.current || choice.size > maxSelected || (onPrepare && !choice.size)) return; pending.current = true; setSaving(true); setError(null);
    try {
      if (!await onSave(units.filter(unit => choice.has(unit.unitId)).map(unit => unit.unitId))) setError('Video selection was not acknowledged. Choices are still here. Check the saved draft before retrying.');
      else if (onPrepare && !await onPrepare()) setError('Selection saved, but preparation could not start. Retry preparing this source.');
    }
    catch { setError('Video selection could not be saved. Choices are still here. Check the saved draft before retrying.'); }
    finally { pending.current = false; setSaving(false); }
  }}>
    <p>{choice.size ? `${choice.size} selected` : 'Choose at least one video to continue.'} · Up to {maxSelected} videos for this source.</p>
    <div className={styles.grid}>{units.map(unit => <label key={unit.unitId} className={styles.card} data-selected={choice.has(unit.unitId)}>
      <input type="checkbox" checked={choice.has(unit.unitId)} disabled={disabled || saving || !choice.has(unit.unitId) && choice.size >= maxSelected} onChange={event => {
        const next = new Set(choice); if (event.target.checked) next.add(unit.unitId); else next.delete(unit.unitId); setChoice(next);
      }} /><YoutubeThumbnail videoId={unit.unitId} /><span>{unit.title}<small>{Math.floor(unit.durationSeconds / 60)}:{String(unit.durationSeconds % 60).padStart(2, '0')}</small></span>
    </label>)}</div>
    <button type="submit" disabled={disabled || saving || choice.size > maxSelected || (!!onPrepare && !choice.size)}>{onPrepare ? 'Use selected videos' : 'Save video selection'}</button>
    {onPrepare && <p className={styles.note}>Creates educational video observations, not transcripts. Coverage is non-exhaustive and timestamps are estimated.</p>}
    {choice.size > maxSelected && <p role="alert">Other sources use this capacity. Deselect videos before saving.</p>}
    {saving && <p role="status">Saving video selection…</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
