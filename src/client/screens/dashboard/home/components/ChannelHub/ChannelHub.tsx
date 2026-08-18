'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Hammer, Headphones, Search, Rabbit, Coffee, Info } from 'lucide-react';
import styles from './ChannelHub.module.css';

// ─── Data ────────────────────────────────────────────────────────────────────

type ChannelId = 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick' | 'spark';

interface Option { id: string; label: string }
interface Control { id: string; label: string; options: Option[]; defaultId: string }
interface Channel { id: ChannelId; name: string; Icon: React.ElementType; description: string; controls: Control[] }

const CHANNELS: Channel[] = [
  {
    id: 'explore', name: 'Explore', Icon: Compass,
    description: 'Find interesting paths beyond what you already know.',
    controls: [
      { id: 'distance', label: 'Distance', defaultId: 'unexpected', options: [{ id: 'nearby', label: 'Nearby' }, { id: 'unexpected', label: 'Unexpected' }, { id: 'far_out', label: 'Far out' }] },
      { id: 'connections', label: 'Connections', defaultId: 'related', options: [{ id: 'related', label: 'Related' }, { id: 'cross_pollinate', label: 'Cross-pollinate' }] },
      { id: 'depth', label: 'Depth', defaultId: 'wander', options: [{ id: 'glance', label: 'Glance' }, { id: 'wander', label: 'Wander' }] },
    ],
  },
  {
    id: 'build', name: 'Build', Icon: Hammer,
    description: 'Turn ideas into something you can actually do.',
    controls: [
      { id: 'guidance', label: 'Guidance', defaultId: 'guided', options: [{ id: 'guided', label: 'Guided' }, { id: 'independent', label: 'Independent' }] },
      { id: 'practice', label: 'Practice', defaultId: 'practice', options: [{ id: 'examples', label: 'Examples' }, { id: 'practice', label: 'Practice' }, { id: 'projects', label: 'Projects' }] },
      { id: 'progression', label: 'Progression', defaultId: 'one_skill', options: [{ id: 'one_skill', label: 'One skill at a time' }, { id: 'combine', label: 'Combine skills' }] },
    ],
  },
  {
    id: 'listen', name: 'Listen', Icon: Headphones,
    description: "Keep learning when the screen doesn't need your attention.",
    controls: [
      { id: 'format', label: 'Format', defaultId: 'narrated', options: [{ id: 'narrated', label: 'Narrated' }, { id: 'conversational', label: 'Conversational' }] },
      { id: 'length', label: 'Length', defaultId: 'short', options: [{ id: 'short', label: 'Short' }, { id: 'longer', label: 'Longer' }] },
      { id: 'visual', label: 'Visual dependency', defaultId: 'audio_first', options: [{ id: 'audio_first', label: 'Audio-first' }, { id: 'some_visual', label: 'Some visual context' }] },
    ],
  },
  {
    id: 'deep_dive', name: 'Deep Dive', Icon: Search,
    description: 'Follow concepts further, build understanding, and stay with difficult ideas.',
    controls: [
      { id: 'focus', label: 'Focus', defaultId: 'understand', options: [{ id: 'understand', label: 'Understand' }, { id: 'go_deeper', label: 'Go deeper' }, { id: 'work_through', label: 'Work through' }] },
      { id: 'progression', label: 'Progression', defaultId: 'follow_thread', options: [{ id: 'follow_thread', label: 'Follow thread' }, { id: 'flexible', label: 'Flexible' }] },
      { id: 'challenge', label: 'Challenge', defaultId: 'build_up', options: [{ id: 'build_up', label: 'Build up' }, { id: 'push_further', label: 'Push further' }] },
    ],
  },
  {
    id: 'quick', name: 'Quick', Icon: Rabbit,
    description: 'Small pieces for small windows of time.',
    controls: [
      { id: 'length', label: 'Length', defaultId: '2_5_min', options: [{ id: '2_5_min', label: '2–5 min' }, { id: '5_10_min', label: '5–10 min' }] },
      { id: 'continuity', label: 'Continuity', defaultId: 'standalone', options: [{ id: 'standalone', label: 'Standalone' }, { id: 'short_sequence', label: 'Short sequence' }] },
      { id: 'density', label: 'Density', defaultId: 'light', options: [{ id: 'light', label: 'Light' }, { id: 'dense', label: 'Dense' }] },
    ],
  },
  {
    id: 'spark', name: 'Spark', Icon: Coffee,
    description: 'Ideas worth stopping for.',
    controls: [
      { id: 'novelty', label: 'Novelty', defaultId: 'unexpected', options: [{ id: 'familiar', label: 'Familiar' }, { id: 'unexpected', label: 'Unexpected' }, { id: 'strange', label: 'Strange' }] },
      { id: 'connection', label: 'Connection', defaultId: 'connections', options: [{ id: 'one_idea', label: 'One idea' }, { id: 'connections', label: 'Connections' }] },
      { id: 'form', label: 'Form', defaultId: 'ideas', options: [{ id: 'ideas', label: 'Ideas' }, { id: 'stories', label: 'Stories' }, { id: 'surprises', label: 'Surprises' }] },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ChannelHub() {
  const [selectedId, setSelectedId] = useState<ChannelId>('deep_dive');
  const [prefs, setPrefs] = useState<Record<string, string>>({});

  const channel = CHANNELS.find(c => c.id === selectedId)!;
  const selectedIdx = CHANNELS.findIndex(c => c.id === selectedId);

  // Wheel rotates so selected segment is at top
  const wheelRotation = -selectedIdx * 60;

  function getPref(channelId: ChannelId, controlId: string, defaultId: string) {
    return prefs[`${channelId}_${controlId}`] ?? defaultId;
  }

  function setPref(channelId: ChannelId, controlId: string, optionId: string) {
    setPrefs(p => ({ ...p, [`${channelId}_${controlId}`]: optionId }));
  }

  return (
    <section className={styles.section} aria-label="Your Channels">
      {/* Header bar — same visual language as Feed Policy */}
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

      {/* Two-column body */}
      <div className={styles.body}>
        {/* LEFT: Wheel */}
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
              const r = 0.63; // radius as fraction of half wheel size
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
                  <Icon size={26} strokeWidth={isActive ? 2.5 : 1.8} />
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
              <svg width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden>
                <circle cx="16" cy="13" r="9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
                <path d="M10 13 Q10 32 16 32 Q22 32 22 13" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* RIGHT: Config panel */}
        <div className={styles.configCol}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className={styles.configPanel}
            >
              <div className={styles.configHeader}>
                <channel.Icon size={22} strokeWidth={2} className={styles.configIcon} />
                <h3 className={styles.configName}>{channel.name}</h3>
              </div>
              <p className={styles.configDesc}>{channel.description}</p>

              <div className={styles.controls}>
                {channel.controls.map(ctrl => {
                  const selected = getPref(channel.id, ctrl.id, ctrl.defaultId);
                  return (
                    <div key={ctrl.id} className={styles.control}>
                      <span className={styles.controlLabel}>{ctrl.label}</span>
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
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
