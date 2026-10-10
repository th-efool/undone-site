'use client';
import { useState } from 'react';

export function YoutubeUnits({ units, selected, disabled, onSave }: {
  units: { unitId: string; title: string; durationSeconds: number }[]; selected: string[]; disabled: boolean;
  onSave: (ids: string[]) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState(() => new Set(selected)); const [saving, setSaving] = useState(false);
  return <form aria-label="Video scope" onSubmit={async event => {
    event.preventDefault(); if (disabled || saving) return; setSaving(true);
    try { await onSave(units.filter(unit => choice.has(unit.unitId)).map(unit => unit.unitId)); }
    finally { setSaving(false); }
  }}>
    <p>Select videos to include. Saving scope retains your choices; it does not claim video content has been processed.</p>
    {units.map(unit => <label key={unit.unitId} style={{ display: 'block' }}>
      <input type="checkbox" checked={choice.has(unit.unitId)} disabled={disabled || saving} onChange={event => {
        const next = new Set(choice); if (event.target.checked) next.add(unit.unitId); else next.delete(unit.unitId); setChoice(next);
      }} /> {unit.title} · {unit.durationSeconds} seconds
    </label>)}
    <button type="submit" disabled={disabled || saving}>Save video selection</button>
    {saving && <p role="status">Saving video selection…</p>}
  </form>;
}
