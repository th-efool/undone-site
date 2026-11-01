'use client';
import { useEffect, useState } from 'react';
import { devLogger, type UndoneLogLevel, type StoredLogEntry } from '@/src/shared/lib/dev-logger';
import styles from './Diagnostics.module.css';
const levels: UndoneLogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
export function DevLoggerInit() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<UndoneLogLevel>('INFO');
  const [logs, setLogs] = useState<StoredLogEntry[]>([]);
  const [runs, setRuns] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const enabled = new URLSearchParams(location.search).get('debug') === '1';
    setOpen(enabled);
    if (enabled) { devLogger.setLevel('DEBUG'); setLevel('DEBUG'); }
    devLogger.info('Browser', 'client_initialized');
  }, []);
  useEffect(() => {
    if (!open) return;
    const tick = () => setLogs(devLogger.getRecentLogs({ limit: 100 }));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open]);
  async function refreshRuns() {
    const workspaceId = location.pathname.match(/^\/quest\/build\/([a-f0-9-]{36})$/i)?.[1];
    if (!workspaceId) { setRuns('Open a workspace to inspect its runs.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/cohort-builder/workspaces/' + workspaceId + '/diagnostics', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Run diagnostics unavailable (' + response.status + ').');
      setRuns(JSON.stringify(await response.json(), null, 2));
    } catch (error) { setRuns(error instanceof Error ? error.message : 'Diagnostics unavailable.'); }
    finally { setBusy(false); }
  }
  if (!open) return null;
  return <section className={styles.panel} aria-label="Diagnostics">
    <header><strong>Diagnostics</strong><button type="button" onClick={() => setOpen(false)}>Close</button></header>
    <p>Browser logging level; server runs below are saved status summaries, not live process logs.</p>
    <label>Capture level <select value={level} onChange={event => { const value = event.target.value as UndoneLogLevel; setLevel(value); devLogger.setLevel(value); }}>
      {levels.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <button type="button" onClick={() => { devLogger.disable(); setOpen(false); }}>Disable debugging</button>
    <button type="button" onClick={() => { devLogger.clear(); setLogs([]); }}>Clear browser buffer</button>
    <button type="button" disabled={busy} onClick={() => void refreshRuns()}>Refresh owned workspace runs</button>
    <pre>{runs}</pre>
    <p>Last 100 browser events; extra data omitted. Full local details remain available through window.__UNDONE_LOGGER__ in your console.</p>
    <pre>{logs.map(log => log.timestamp + ' ' + log.level + ' [' + log.tag + '] ' + log.message.slice(0, 500)).join('\n')}</pre>
  </section>;
}
