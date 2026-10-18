import React from 'react';
import styles from '../Play.module.css';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { Settings2, Search, X } from 'lucide-react';

interface ChannelSelectorProps {
  activeChannel: ChannelId;
  onChannelSelect: (channel: ChannelId) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onPrefsUpdated?: () => void;
  isInline?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CHANNELS: { id: ChannelId; label: string; desc: string }[] = [
  { id: 'default', label: 'Default', desc: 'Balanced sequential progression' },
  { id: 'spark', label: 'Spark', desc: 'High-energy insights & hooks' },
  { id: 'explore', label: 'Explore', desc: 'Broad cross-topic discovery' },
  { id: 'build', label: 'Build', desc: 'Hands-on code & implementation' },
  { id: 'listen', label: 'Listen', desc: 'Audio-friendly conceptual talks' },
  { id: 'deep_dive', label: 'Deep Dive', desc: 'Rigorous theory & architecture' },
  { id: 'quick', label: 'Quick', desc: 'Fast bite-sized micro-chunks' },
];

const QUICK_PREFS_BY_CHANNEL: Partial<Record<ChannelId, { key: string; label: string; options: { id: string; text: string }[] }>> = {
  quick: {
    key: 'quick_max_duration',
    label: 'Max Bite Size',
    options: [
      { id: '3', text: '≤ 3m' },
      { id: '5', text: '≤ 5m' },
      { id: '10', text: '≤ 10m' },
    ],
  },
  build: {
    key: 'build_guidance',
    label: 'Guidance Style',
    options: [
      { id: 'step_by_step', text: 'Guided' },
      { id: 'open_sandbox', text: 'Sandbox' },
    ],
  },
  deep_dive: {
    key: 'deep_dive_rigor',
    label: 'Rigor Level',
    options: [
      { id: 'intuitive', text: 'Intuitive' },
      { id: 'formal', text: 'Formal' },
    ],
  },
  spark: {
    key: 'spark_novelty',
    label: 'Novelty',
    options: [
      { id: 'familiar', text: 'Core' },
      { id: 'esoteric', text: 'Esoteric' },
    ],
  },
};

export function ChannelSelector({
  activeChannel,
  onChannelSelect,
  searchQuery = '',
  onSearchQueryChange,
  onPrefsUpdated,
  isInline,
  isOpen: controlledIsOpen,
  onOpenChange,
}: ChannelSelectorProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = React.useCallback(
    (open: boolean) => {
      setInternalIsOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  const [draftQuery, setDraftQuery] = React.useState(searchQuery);
  const [prefsMap, setPrefsMap] = React.useState<Record<string, string>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sidequest_channel_prefs');
        if (stored) setPrefsMap(JSON.parse(stored));
      } catch {}
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handlePrefSelect = (prefKey: string, optionId: string) => {
    const updated = { ...prefsMap, [prefKey]: optionId };
    setPrefsMap(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidequest_channel_prefs', JSON.stringify(updated));
    }
    onPrefsUpdated?.();
  };

  const activeControl = QUICK_PREFS_BY_CHANNEL[activeChannel];

  return (
    <div className={isInline ? styles.channelSelectorInline : styles.channelSelectorWrapper} ref={containerRef}>
      <button 
        ref={triggerRef}
        className={styles.channelSelectorTrigger} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Channel"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="channel-selector-popover"
      >
        <Settings2 size={16} />
        <span>{CHANNELS.find(c => c.id === activeChannel)?.label || 'Channel'}</span>
        {searchQuery ? <span style={{ fontSize: '0.72rem', color: '#a5b4fc', marginLeft: 4 }}>• &ldquo;{searchQuery}&rdquo;</span> : null}
      </button>

      {isOpen && (
        <div
          id="channel-selector-popover"
          role="region"
          aria-label="Channel and search preferences"
          className={styles.channelSelectorDropdown}
          style={{ minWidth: 250 }}
        >
          {onSearchQueryChange && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearchQueryChange(draftQuery.trim());
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 8,
                padding: '6px 8px',
                marginBottom: 6,
              }}
            >
              <Search size={13} color="#94a3b8" />
              <input
                type="text"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="RAG topic filter (e.g. cargo, memory)..."
                aria-label="RAG topic filter"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '0.78rem',
                  width: '100%',
                }}
              />
              {draftQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftQuery('');
                    onSearchQueryChange('');
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  aria-label="Clear topic filter"
                >
                  <X size={13} />
                </button>
              )}
            </form>
          )}

          <div className={styles.channelSelectorHeader}>Select Channel</div>
          <div className={styles.channelSelectorList}>
            {CHANNELS.map(channel => (
              <button
                key={channel.id}
                className={`${styles.channelOption} ${activeChannel === channel.id ? styles.channelOptionActive : ''}`}
                onClick={() => {
                  onChannelSelect(channel.id);
                  setIsOpen(false);
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
              >
                <span>{channel.label}</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.6, fontWeight: 400 }}>{channel.desc}</span>
              </button>
            ))}
          </div>

          {activeControl && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6 }}>
              <div className={styles.channelSelectorHeader}>{activeControl.label}</div>
              <div style={{ display: 'flex', gap: 4, padding: '0 4px 4px' }}>
                {activeControl.options.map((opt) => {
                  const isSelected = prefsMap[activeControl.key] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePrefSelect(activeControl.key, opt.id)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.12)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)',
                        color: isSelected ? '#c7d2fe' : '#cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
