import React, { useState } from 'react';
import { Search, Plus, LayoutGrid, Menu, Pin, Star, Share, Trash2 } from 'lucide-react';
import styles from './NotesSidebar.module.css';

const CHANNELS = [
  'Machine Learning',
  'Anytype Community',
  'System Design',
  'Expat Community',
  'Zuri',
  'Deja',
  'Mochi',
  'Andy',
  'Any Documentation',
  'azk',
  'AnyCreator',
  'Anytype Demo',
];

export function NotesSidebar() {
  const [selectedChannel, setSelectedChannel] = useState('Machine Learning');
  
  return (
    <aside className={styles.sidebar}>
      {/* 1. Top Section */}
      <div className={styles.topBar}>
        <div className={styles.topBarActions}>
          <button className={styles.iconButton}>
            <Plus size={18} />
          </button>
          <button className={styles.iconButton}>
            <LayoutGrid size={18} />
          </button>
          <button className={styles.iconButton}>
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* 2. Search */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <Search className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Filter channels..." 
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* 3 & 4. Channel List */}
      <div className={styles.channelList}>
        {CHANNELS.map((channel, idx) => (
          <div 
            key={channel} 
            className={`${styles.channelItem} ${selectedChannel === channel ? styles.selected : ''}`}
            onClick={() => setSelectedChannel(channel)}
          >
            <div className={styles.avatar} style={{ backgroundColor: `hsl(${idx * 30}, 60%, 50%)` }}>
              {channel.charAt(0)}
            </div>
            <span className={styles.channelName}>{channel}</span>
            <Pin className={styles.pinIcon} />
          </div>
        ))}
      </div>

      {/* 6. Bottom Pinned Items */}
      <div className={styles.bottomSection}>
        <div className={styles.bottomItem}>
          <Star className={styles.bottomIcon} fill="#fbbf24" color="#fbbf24" />
          <span>Favorites</span>
          <span className={styles.bottomCount}>8</span>
        </div>
        <div className={styles.bottomItem}>
          <Share className={styles.bottomIcon} />
          <span>Shared with me</span>
          <span className={styles.bottomCount}>⇧ 7</span>
        </div>
        <div className={styles.bottomItem}>
          <Trash2 className={styles.bottomIcon} />
          <span>Trash</span>
        </div>
      </div>
    </aside>
  );
}
