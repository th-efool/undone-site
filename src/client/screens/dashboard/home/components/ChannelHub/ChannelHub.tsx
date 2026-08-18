'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Hammer, Headphones, Search, Rabbit, Coffee, Info } from 'lucide-react';
import styles from './ChannelHub.module.css';

// ─── Data ────────────────────────────────────────────────────────────────────

type ChannelId = 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

interface Option { id: string; label: string }
interface Control { id: string; label: string; options: Option[]; defaultId: string }
interface Channel {
  id: ChannelId;
  name: string;
  Icon: React.ElementType;
  tagline: string;
  about: string;
  bestFor: string[];
  controls: Control[];
}

const CHANNELS: Channel[] = [
  {
    id: 'spark',
    name: 'Spark',
    Icon: Coffee,
    tagline: 'Fresh ideas to ignite your curiosity.',
    about: 'Perfect for moments when you want something interesting to think about without committing to a particular topic or direction.',
    bestFor: ['Idle moments', 'New interests', 'Inspiration'],
    controls: [
      { id: 'novelty', label: 'Novelty', defaultId: 'unexpected', options: [{ id: 'familiar', label: 'Familiar' }, { id: 'unexpected', label: 'Unexpected' }, { id: 'strange', label: 'Strange' }] },
      { id: 'connection', label: 'Connection', defaultId: 'connections', options: [{ id: 'one_idea', label: 'One idea' }, { id: 'connections', label: 'Connections' }] },
      { id: 'form', label: 'Form', defaultId: 'ideas', options: [{ id: 'ideas', label: 'Ideas' }, { id: 'stories', label: 'Stories' }, { id: 'surprises', label: 'Surprises' }] },
    ],
  },
  {
    id: 'explore',
    name: 'Explore',
    Icon: Compass,
    tagline: 'Discover new topics and perspectives.',
    about: 'Perfect for when you want to follow your curiosity, make unexpected connections, or see where an idea takes you.',
    bestFor: ['Curious moods', 'Cross-domain', 'Open time'],
    controls: [
      { id: 'distance', label: 'Distance', defaultId: 'unexpected', options: [{ id: 'nearby', label: 'Nearby' }, { id: 'unexpected', label: 'Unexpected' }, { id: 'far_out', label: 'Far out' }] },
      { id: 'connections', label: 'Connections', defaultId: 'related', options: [{ id: 'related', label: 'Related' }, { id: 'cross_pollinate', label: 'Cross-pollinate' }] },
      { id: 'depth', label: 'Depth', defaultId: 'wander', options: [{ id: 'glance', label: 'Glance' }, { id: 'wander', label: 'Wander' }] },
    ],
  },
  {
    id: 'build',
    name: 'Build',
    Icon: Hammer,
    tagline: 'Hands-on learning. Projects & practice.',
    about: 'Perfect for when you want to turn what you know into something you can actually make, solve, or do.',
    bestFor: ['Skill building', 'Projects', 'Practice'],
    controls: [
      { id: 'guidance', label: 'Guidance', defaultId: 'guided', options: [{ id: 'guided', label: 'Guided' }, { id: 'independent', label: 'Independent' }] },
      { id: 'practice', label: 'Practice', defaultId: 'practice', options: [{ id: 'examples', label: 'Examples' }, { id: 'practice', label: 'Practice' }, { id: 'projects', label: 'Projects' }] },
      { id: 'progression', label: 'Progression', defaultId: 'one_skill', options: [{ id: 'one_skill', label: 'One skill at a time' }, { id: 'combine', label: 'Combine skills' }] },
    ],
  },
  {
    id: 'listen',
    name: 'Listen',
    Icon: Headphones,
    tagline: 'Learn on the go with audio sessions.',
    about: 'Perfect for walks, commutes, or whenever you want to keep learning without needing to stay in front of a screen.',
    bestFor: ['Commutes', 'Walks', 'Screen-free'],
    controls: [
      { id: 'format', label: 'Format', defaultId: 'narrated', options: [{ id: 'narrated', label: 'Narrated' }, { id: 'conversational', label: 'Conversational' }] },
      { id: 'length', label: 'Length', defaultId: 'short', options: [{ id: 'short', label: 'Short' }, { id: 'longer', label: 'Longer' }] },
      { id: 'visual', label: 'Visual dependency', defaultId: 'audio_first', options: [{ id: 'audio_first', label: 'Audio-first' }, { id: 'some_visual', label: 'Some visual context' }] },
    ],
  },
  {
    id: 'deep_dive',
    name: 'Deep Dive',
    Icon: Search,
    tagline: 'In-depth lessons for deep understanding.',
    about: 'Perfect for when you want to slow down, follow an idea further, and really understand how it works.',
    bestFor: ['Focused time', 'Complex topics', 'Deep work'],
    controls: [
      { id: 'focus', label: 'Focus', defaultId: 'understand', options: [{ id: 'understand', label: 'Understand' }, { id: 'go_deeper', label: 'Go deeper' }, { id: 'work_through', label: 'Work through' }] },
      { id: 'progression', label: 'Progression', defaultId: 'follow_thread', options: [{ id: 'follow_thread', label: 'Follow thread' }, { id: 'flexible', label: 'Flexible' }] },
      { id: 'challenge', label: 'Challenge', defaultId: 'build_up', options: [{ id: 'build_up', label: 'Build up' }, { id: 'push_further', label: 'Push further' }] },
    ],
  },
  {
    id: 'quick',
    name: 'Quick',
    Icon: Rabbit,
    tagline: 'Small pieces for small windows of time.',
    about: 'Quick delivers crisp, focused bites of learning you can finish in just a few minutes. Perfect for breaks, commutes, or whenever you need a quick win.',
    bestFor: ['Busy days', 'Short breaks', 'On the go'],
    controls: [
      { id: 'length', label: 'Length', defaultId: '2_5_min', options: [{ id: '2_5_min', label: '2–5 min' }, { id: '5_10_min', label: '5–10 min' }] },
      { id: 'continuity', label: 'Continuity', defaultId: 'standalone', options: [{ id: 'standalone', label: 'Standalone' }, { id: 'short_sequence', label: 'Short sequence' }] },
      { id: 'density', label: 'Density', defaultId: 'light', options: [{ id: 'light', label: 'Light' }, { id: 'dense', label: 'Dense' }] },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ChannelHub() {
  const [selectedId, setSelectedId] = useState<ChannelId>('quick');
  const [prefs, setPrefs] = useState<Record<string, string>>({});

  const channel = CHANNELS.find(c => c.id === selectedId)!;

  function getPref(channelId: ChannelId, controlId: string, defaultId: string) {
    return prefs[`${channelId}_${controlId}`] ?? defaultId;
  }

  function setPref(channelId: ChannelId, controlId: string, optionId: string) {
    setPrefs(p => ({ ...p, [`${channelId}_${controlId}`]: optionId }));
  }

  return (
    <section className={styles.section} aria-label="Your Channels">
      {/* Header bar */}
      <div className={styles.headerBar}>
        <div className={styles.tabTrapezium}>
          <h2 className={styles.tabTitle}>Your Channels</h2>
        </div>
        <div className={styles.indigoBar}>
          <button className={styles.learnBtn} aria-label="Learn how channels work">
            <Info size={13} />
            Learn how it works
          </button>
        </div>
      </div>

      {/* 4-column body: intro | wheel | channel list | detail */}
      <div className={styles.body}>

        {/* COL 1: Intro text */}
        <div className={styles.introCol}>
          <span className={styles.introEyebrow}>Your Channels</span>
          <p className={styles.introHeadline}>Tune in to the channels that match your moment.</p>
          <p className={styles.introBody}>
            Each channel is a learning experience with its own rhythm and focus.
            Pick a channel to personalize your feed.
          </p>
          <button className={styles.customizeBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
            Customize My Guide
          </button>
        </div>

        {/* COL 2: Wheel */}
        <div className={styles.wheelCol}>
          <div className={styles.wheelOuter}>
            {/* SVG pie segments */}
            <svg className={styles.wheelSvg} viewBox="-1 -1 2 2" aria-hidden>
              {CHANNELS.map((ch, i) => {
                const startAngle = (i / 6) * 2 * Math.PI - Math.PI / 2;
                const endAngle = ((i + 1) / 6) * 2 * Math.PI - Math.PI / 2;
                const isActive = ch.id === selectedId;
                const x1 = Math.cos(startAngle) * 0.95;
                const y1 = Math.sin(startAngle) * 0.95;
                const x2 = Math.cos(endAngle) * 0.95;
                const y2 = Math.sin(endAngle) * 0.95;
                return (
                  <path
                    key={ch.id}
                    d={`M 0 0 L ${x1} ${y1} A 0.95 0.95 0 0 1 ${x2} ${y2} Z`}
                    className={`${styles.segment} ${isActive ? styles.segmentActive : ''}`}
                    onClick={() => setSelectedId(ch.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={ch.name}
                    onKeyDown={e => e.key === 'Enter' && setSelectedId(ch.id)}
                  />
                );
              })}
            </svg>

            {/* Icon labels around the wheel */}
            {CHANNELS.map((ch, i) => {
              const angle = ((i + 0.5) / 6) * 2 * Math.PI - Math.PI / 2;
              const r = 0.63;
              const isActive = ch.id === selectedId;
              const Icon = ch.Icon;
              return (
                <button
                  key={ch.id}
                  className={`${styles.segmentLabel} ${isActive ? styles.segmentLabelActive : ''}`}
                  style={{
                    left: `${50 + r * 50 * Math.cos(angle)}%`,
                    top: `${50 + r * 50 * Math.sin(angle)}%`,
                  }}
                  onClick={() => setSelectedId(ch.id)}
                  aria-label={ch.name}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{ch.name}</span>
                </button>
              );
            })}

            {/* Divider lines */}
            <svg className={styles.wheelSvg} viewBox="-1 -1 2 2" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
              {CHANNELS.map((_, i) => {
                const angle = (i / 6) * 2 * Math.PI - Math.PI / 2;
                return (
                  <line
                    key={i}
                    x1={0} y1={0}
                    x2={Math.cos(angle) * 0.95}
                    y2={Math.sin(angle) * 0.95}
                    stroke="white"
                    strokeWidth="0.015"
                  />
                );
              })}
            </svg>

            {/* Center keyhole */}
            <div className={styles.center}>
              <svg width="28" height="35" viewBox="0 0 32 40" fill="none" aria-hidden>
                <circle cx="16" cy="13" r="9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
                <path d="M10 13 Q10 32 16 32 Q22 32 22 13" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* COL 3: Channel list */}
        <div className={styles.channelListCol}>
          {CHANNELS.map(ch => {
            const isActive = ch.id === selectedId;
            const Icon = ch.Icon;
            return (
              <button
                key={ch.id}
                className={`${styles.channelRow} ${isActive ? styles.channelRowActive : ''}`}
                onClick={() => setSelectedId(ch.id)}
                aria-pressed={isActive}
              >
                <div className={`${styles.channelRowIcon} ${isActive ? styles.channelRowIconActive : ''}`}>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className={styles.channelRowText}>
                  <span className={styles.channelRowName}>{ch.name.toUpperCase()}</span>
                  <span className={styles.channelRowTagline}>{ch.tagline}</span>
                </div>
                {isActive && (
                  <div className={styles.channelRowCheck}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="7" fill="#4f46e5" />
                      <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* COL 4: Detail panel */}
        <div className={styles.detailCol}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              className={styles.detailPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
            >
              {/* Header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailIconWrap}>
                  <channel.Icon size={18} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className={styles.detailName}>{channel.name}</h3>
                  <p className={styles.detailTagline}>{channel.tagline}</p>
                </div>
              </div>

              {/* About */}
              <div className={styles.detailSection}>
                <span className={styles.detailSectionLabel}>About this channel</span>
                <p className={styles.detailAbout}>{channel.about}</p>
              </div>

              {/* Best for */}
              <div className={styles.detailSection}>
                <span className={styles.detailSectionLabel}>Best for</span>
                <div className={styles.pills}>
                  {channel.bestFor.map(tag => (
                    <span key={tag} className={styles.bestForPill}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Controls */}
              {channel.controls.map(ctrl => {
                const selected = getPref(channel.id, ctrl.id, ctrl.defaultId);
                return (
                  <div key={ctrl.id} className={styles.detailSection}>
                    <span className={styles.detailSectionLabel}>{ctrl.label}</span>
                    <div className={styles.pills}>
                      {ctrl.options.map(opt => (
                        <button
                          key={opt.id}
                          className={`${styles.pill} ${selected === opt.id ? styles.pillActive : styles.pillIdle}`}
                          onClick={() => setPref(channel.id, ctrl.id, opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
