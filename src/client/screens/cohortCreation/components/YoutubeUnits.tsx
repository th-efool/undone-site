'use client';
import { useRef, useState } from 'react';
import { YoutubeThumbnail } from './YoutubeThumbnail';

export function YoutubeUnits({ units, selected, disabled, onSave, maxSelected = 100 }: {
  units: { unitId: string; title: string; durationSeconds: number }[]; selected: string[]; disabled: boolean;
  onSave: (ids: string[]) => Promise<boolean>;
  maxSelected?: number;
}) {
  const [choice, setChoice] = useState(() => new Set(selected)); const [saving, setSaving] = useState(false);
  const pending = useRef(false); const [error, setError] = useState<string | null>(null);
  return <form aria-label="Video scope" onSubmit={async event => {
    event.preventDefault(); if (disabled || pending.current || choice.size > maxSelected) return; pending.current = true; setSaving(true); setError(null);
    try { if (!await onSave(units.filter(unit => choice.has(unit.unitId)).map(unit => unit.unitId))) setError('Video selection was not acknowledged. Choices are still here. Check the saved draft before retrying.'); }
    catch { setError('Video selection could not be saved. Choices are still here. Check the saved draft before retrying.'); }
    finally { pending.current = false; setSaving(false); }
  }}>
    <p>Select videos to include. Saving scope retains your choices; it does not claim video content has been processed.</p>
    <p>Up to {maxSelected} videos available for this source within the draft’s 100-unit limit.</p>
    {units.map(unit => <label key={unit.unitId} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 8 }}>
      <input type="checkbox" checked={choice.has(unit.unitId)} disabled={disabled || saving || !choice.has(unit.unitId) && choice.size >= maxSelected} onChange={event => {
        const next = new Set(choice); if (event.target.checked) next.add(unit.unitId); else next.delete(unit.unitId); setChoice(next);
      }} /><YoutubeThumbnail videoId={unit.unitId} /><span>{unit.title} · {unit.durationSeconds} seconds</span>
    </label>)}
    <button type="submit" disabled={disabled || saving || choice.size > maxSelected}>Save video selection</button>
    {choice.size > maxSelected && <p role="alert">Other sources use this capacity. Deselect videos before saving.</p>}
    {saving && <p role="status">Saving video selection…</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
