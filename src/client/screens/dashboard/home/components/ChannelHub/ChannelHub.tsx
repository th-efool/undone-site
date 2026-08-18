'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Hammer, Headphones, Search, Rabbit, Coffee, Info, Tv, Clock, Zap, Map, Footprints, BookOpen, Layers, Focus, Brain, Target, Briefcase, MonitorOff, Car, Star, Lightbulb, PlayCircle, Activity } from 'lucide-react';
import styles from './ChannelHub.module.css';

// ─── Data ────────────────────────────────────────────────────────────────────

type ChannelId = 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';

interface Option { id: string; label: string }
interface Control { id: string; label: string; options: Option[]; defaultId: string }
interface BestFor { text: string; Icon: React.ElementType }
interface Channel {
  id: ChannelId;
  name: string;
  Icon: React.ElementType;
  tagline: string;
  about: string;
  bestFor: BestFor[];
  controls: Control[];
}

const CHANNELS: Channel[] = [
  {
    id: 'spark',
    name: 'Spark',
    Icon: Coffee,
    tagline: 'Fresh ideas to ignite your curiosity.',
    about: 'Perfect for moments when you want something interesting to think about without committing to a particular topic or direction.',
    bestFor: [{ text: 'Idle moments', Icon: Clock }, { text: 'New interests', Icon: Lightbulb }, { text: 'Inspiration', Icon: Zap }],
    controls: [
      { id: 'novelty', label: 'Novelty', defaultId: 'familiar', options: [{ id: 'familiar', label: 'Familiar' }, { id: 'esoteric', label: 'Esoteric' }] },
      { id: 'connectivity', label: 'Connectivity', defaultId: 'singular', options: [{ id: 'singular', label: 'Singular' }, { id: 'cross_domain', label: 'Cross-Domain' }] },
      { id: 'abstraction', label: 'Abstraction', defaultId: 'concrete', options: [{ id: 'concrete', label: 'Concrete Fact' }, { id: 'philosophical', label: 'Philosophical Mystery' }] },
    ],
  },
  {
    id: 'explore',
    name: 'Explore',
    Icon: Compass,
    tagline: 'Discover new topics and perspectives.',
    about: 'Perfect for when you want to follow your curiosity, make unexpected connections, or see where an idea takes you.',
    bestFor: [{ text: 'Curious moods', Icon: Brain }, { text: 'Cross-domain', Icon: Layers }, { text: 'Open time', Icon: Map }],
    controls: [
      { id: 'novelty', label: 'Novelty', defaultId: 'adjacent', options: [{ id: 'adjacent', label: 'Adjacent' }, { id: 'uncharted', label: 'Uncharted' }] },
      { id: 'scope', label: 'Scope', defaultId: 'deep', options: [{ id: 'deep', label: 'Deep' }, { id: 'wide', label: 'Wide' }] },
      { id: 'serendipity', label: 'Serendipity', defaultId: 'curated', options: [{ id: 'curated', label: 'Curated' }, { id: 'random', label: 'Random' }] },
    ],
  },
  {
    id: 'build',
    name: 'Build',
    Icon: Hammer,
    tagline: 'Hands-on learning. Projects & practice.',
    about: 'Perfect for when you want to turn what you know into something you can actually make, solve, or do.',
    bestFor: [{ text: 'Skill building', Icon: Target }, { text: 'Projects', Icon: Briefcase }, { text: 'Practice', Icon: Activity }],
    controls: [
      { id: 'guidance', label: 'Guidance', defaultId: 'step_by_step', options: [{ id: 'step_by_step', label: 'Step-by-Step Tutorial' }, { id: 'independent', label: 'Independent Build' }] },
      { id: 'scope', label: 'Scope', defaultId: 'micro', options: [{ id: 'micro', label: 'Micro-Feature' }, { id: 'full_app', label: 'Full-Scale App' }] },
      { id: 'constraint', label: 'Constraint', defaultId: 'blueprint', options: [{ id: 'blueprint', label: 'Strict Blueprint' }, { id: 'sandbox', label: 'Open Sandbox' }] },
    ],
  },
  {
    id: 'listen',
    name: 'Listen',
    Icon: Headphones,
    tagline: 'Learn on the go with audio sessions.',
    about: 'Perfect for walks, commutes, or whenever you want to keep learning without needing to stay in front of a screen.',
    bestFor: [{ text: 'Commutes', Icon: Car }, { text: 'Walks', Icon: Footprints }, { text: 'Screen-free', Icon: MonitorOff }],
    controls: [
      { id: 'format', label: 'Format', defaultId: 'story', options: [{ id: 'story', label: 'Story' }, { id: 'interview', label: 'Interview' }] },
      { id: 'density', label: 'Density', defaultId: 'casual', options: [{ id: 'casual', label: 'Casual Overview' }, { id: 'technical', label: 'Technical Deep Dive' }] },
      { id: 'length', label: 'Length', defaultId: 'short', options: [{ id: 'short', label: 'Short' }, { id: 'extended', label: 'Extended' }] },
    ],
  },
  {
    id: 'deep_dive',
    name: 'Deep Dive',
    Icon: Search,
    tagline: 'In-depth lessons for deep understanding.',
    about: 'Perfect for when you want to slow down, follow an idea further, and really understand how it works.',
    bestFor: [{ text: 'Focused time', Icon: Focus }, { text: 'Complex topics', Icon: BookOpen }, { text: 'Deep work', Icon: Brain }],
    controls: [
      { id: 'depth', label: 'Depth', defaultId: 'high_level', options: [{ id: 'high_level', label: 'High-level' }, { id: 'first_principles', label: 'First Principles' }] },
      { id: 'rigor', label: 'Rigor', defaultId: 'intuitive', options: [{ id: 'intuitive', label: 'Intuitive' }, { id: 'formal', label: 'Formal' }] },
      { id: 'scaffolding', label: 'Scaffolding', defaultId: 'guided', options: [{ id: 'guided', label: 'Guided' }, { id: 'independent', label: 'Independent' }] },
    ],
  },
  {
    id: 'quick',
    name: 'Quick',
    Icon: Rabbit,
    tagline: 'Small pieces for small windows of time.',
    about: 'Quick delivers crisp, focused bites of learning you can finish in just a few minutes. Perfect for breaks, commutes, or whenever you need a quick win.',
    bestFor: [{ text: 'Busy days', Icon: Briefcase }, { text: 'Short breaks', Icon: Clock }, { text: 'On the go', Icon: PlayCircle }],
    controls: [
      { id: 'length', label: 'Length', defaultId: 'micro', options: [{ id: 'micro', label: 'Micro' }, { id: 'brief', label: 'Brief' }] },
      { id: 'continuity', label: 'Continuity', defaultId: 'standalone', options: [{ id: 'standalone', label: 'Standalone' }, { id: 'sequence', label: 'Sequence' }] },
      { id: 'density', label: 'Density', defaultId: 'light', options: [{ id: 'light', label: 'Light' }, { id: 'dense', label: 'Dense' }] },
    ],
  },
];

import { Slider } from '@/src/client/components/ui/Slider/Slider';

function FloatSliderControl({ 
  ctrl, 
  selectedId, 
  onChange 
}: { 
  ctrl: Control; 
  selectedId: string; 
  onChange: (id: string) => void 
}) {
  const selectedIndex = Math.max(0, ctrl.options.findIndex(o => o.id === selectedId));
  const [floatVal, setFloatVal] = useState(selectedIndex);
  const [inputValue, setInputValue] = useState(floatVal.toFixed(2));

  useEffect(() => {
    setInputValue(floatVal.toFixed(2));
  }, [floatVal]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFloatVal(val);
    const closestIndex = Math.round(val);
    if (closestIndex !== selectedIndex && ctrl.options[closestIndex]) {
      onChange(ctrl.options[closestIndex].id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);

    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= ctrl.options.length - 1) {
      setFloatVal(parsed);
    }
  };

  const handleInputBlur = () => {
    let val = parseFloat(inputValue);
    if (isNaN(val) || val < 0 || val > ctrl.options.length - 1) {
      setInputValue(floatVal.toFixed(2));
      return;
    }
    setFloatVal(val);
    setInputValue(val.toFixed(2));
    const closestIndex = Math.round(val);
    if (closestIndex !== selectedIndex && ctrl.options[closestIndex]) {
      onChange(ctrl.options[closestIndex].id);
    }
  };

  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderRowTitle}>{ctrl.label}</span>
      <div className={styles.sliderRowTrack}>
        <span 
          className={`${styles.sliderLabel} ${Math.round(floatVal) === 0 ? styles.sliderLabelActive : ''}`}
          onClick={() => {
            setFloatVal(0);
            onChange(ctrl.options[0].id);
          }}
        >
          {ctrl.options[0].label}
        </span>
        
        <div className={styles.sliderInputWrapper}>
          <Slider 
            min={0} 
            max={ctrl.options.length - 1} 
            step={0.01} 
            value={floatVal}
            onChange={handleChange}
            className={styles.floatSlider}
          />
        </div>

        <span 
          className={`${styles.sliderLabel} ${Math.round(floatVal) === 1 ? styles.sliderLabelActive : ''}`}
          onClick={() => {
            setFloatVal(1);
            if(ctrl.options[1]) onChange(ctrl.options[1].id);
          }}
        >
          {ctrl.options[1]?.label}
        </span>
      </div>
      <input 
        type="text"
        className={styles.sliderFloatInput}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

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

      {/* 4-column flush layout (desktop app style) */}
      <div className={styles.body}>

        {/* COL 1: Intro text */}
        <div className={styles.introCol}>
          <p className={styles.introHeadline}>Tune in to the channels that match your moment.</p>
          <p className={styles.introBody}>
            Each channel is a learning experience with its own rhythm and focus.
            Pick a channel to personalize your feed.
          </p>
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
                  className={`${styles.wheelLabelBtn} ${isActive ? styles.wheelLabelBtnActive : ''}`}
                  style={{
                    left: `${50 + r * 50 * Math.cos(angle)}%`,
                    top: `${50 + r * 50 * Math.sin(angle)}%`,
                  }}
                  onClick={() => setSelectedId(ch.id)}
                  aria-label={ch.name}
                >
                  <Icon size={32} strokeWidth={isActive ? 2.5 : 1.8} />
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

            {/* Center icon */}
            <div className={styles.center}>
              <Tv size={36} color="white" strokeWidth={1.5} />
            </div>
          </div>
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
                <channel.Icon size={40} strokeWidth={1.5} className={styles.detailBigIcon} />
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
                  {channel.bestFor.map(item => (
                    <span key={item.text} className={styles.bestForPill}>
                      <item.Icon size={14} strokeWidth={2.5} />
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Controls (Sliders) */}
              <div className={styles.controlsGrid}>
                {channel.controls.map(ctrl => {
                  const selected = getPref(channel.id, ctrl.id, ctrl.defaultId);
                  
                  return (
                    <FloatSliderControl 
                      key={ctrl.id}
                      ctrl={ctrl} 
                      selectedId={selected} 
                      onChange={(id) => setPref(channel.id, ctrl.id, id)} 
                    />
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
