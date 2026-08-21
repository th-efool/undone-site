import React from 'react';
import styles from '../Play.module.css';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { Settings2 } from 'lucide-react';

interface ChannelSelectorProps {
  activeChannel: ChannelId;
  onChannelSelect: (channel: ChannelId) => void;
  isInline?: boolean;
}

const CHANNELS: { id: ChannelId; label: string; icon?: React.ReactNode }[] = [
  { id: 'default', label: 'Default' },
  { id: 'spark', label: 'Spark' },
  { id: 'explore', label: 'Explore' },
  { id: 'build', label: 'Build' },
  { id: 'listen', label: 'Listen' },
  { id: 'deep_dive', label: 'Deep Dive' },
  { id: 'quick', label: 'Quick' },
];

export function ChannelSelector({ activeChannel, onChannelSelect, isInline }: ChannelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={isInline ? styles.channelSelectorInline : styles.channelSelectorWrapper} ref={containerRef}>
      <button 
        className={styles.channelSelectorTrigger} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Channel"
      >
        <Settings2 size={16} />
        <span>{CHANNELS.find(c => c.id === activeChannel)?.label || 'Channel'}</span>
      </button>

      {isOpen && (
        <div className={styles.channelSelectorDropdown}>
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
              >
                {channel.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
