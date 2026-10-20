'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Clock, 
  Zap, 
  Flame, 
  Coffee 
} from 'lucide-react';
import styles from '../StudyRoomScreen.module.css';

export interface PresetOption {
  label: string;
  minutes: number;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
}

export const PRESETS: readonly PresetOption[] = [
  { label: 'Hyperfocus', minutes: 50, icon: Zap },
  { label: 'Deep Work', minutes: 25, icon: Flame },
  { label: 'Short Break', minutes: 5, icon: Coffee },
  { label: 'Long Break', minutes: 15, icon: Clock },
] as const;

export interface FocusTimerCardProps {
  onComplete?: (message: string) => void;
}

export const FocusTimerCard = React.memo(function FocusTimerCard({
  onComplete,
}: FocusTimerCardProps) {
  // Encapsulated local timer state
  const [duration, setDuration] = useState<number>(25 * 60); // 25 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>('Deep Work');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const soundEnabledRef = useRef(soundEnabled);

  // Keep callback and sound refs updated to avoid re-triggering intervals
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Audio synthesis chime using Web Audio API (no external asset dependencies)
  const playChime = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Warm synth chord
      const playNote = (freq: number, start: number, noteDuration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
        osc.start(start);
        osc.stop(start + noteDuration);
      };

      const now = ctx.currentTime;
      playNote(523.25, now, 1.2); // C5
      playNote(659.25, now + 0.1, 1.0); // E5
      playNote(783.99, now + 0.2, 0.8); // G5
      playNote(1046.5, now + 0.3, 0.8); // C6
    } catch (e) {
      console.error('Audio Synthesis Failed', e);
    }
  }, []);

  // 1-second countdown interval
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            playChime();
            onCompleteRef.current?.('✨ Focus session completed! Great job.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, playChime]);

  // Format Seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Preset Selection
  const handlePresetSelect = (presetLabel: string, minutes: number) => {
    setActivePreset(presetLabel);
    setDuration(minutes * 60);
    setTimeLeft(minutes * 60);
    setIsRunning(false);
  };

  // SVG Circle Progress calculation (circumference = 2 * pi * r = 2 * 3.14 * 45 = 282.6)
  const progressRatio = duration > 0 ? timeLeft / duration : 0;
  const strokeDashoffset = 282.6 * (1 - progressRatio);

  const toggleRunning = () => {
    if (!isRunning && timeLeft === 0) {
      setTimeLeft(duration);
    }
    setIsRunning((prev) => !prev);
  };

  return (
    <div className={styles.timerCard}>
      {/* Timer Header */}
      <div className={styles.timerCardHeader}>
        <div className={styles.timerHeaderIcon}>
          <Clock size={18} />
          <span>Timer Widget</span>
        </div>
        <button
          type="button"
          onClick={() => setSoundEnabled((prev) => !prev)}
          className={styles.soundToggle}
          title={soundEnabled ? 'Mute Chime' : 'Unmute Chime'}
          aria-label={soundEnabled ? 'Mute Chime' : 'Unmute Chime'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Presets Grid */}
      <div className={styles.presetsGrid}>
        {PRESETS.map((p) => {
          const PIcon = p.icon;
          const isSelected = activePreset === p.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePresetSelect(p.label, p.minutes)}
              className={`${styles.presetBtn} ${isSelected ? styles.activePreset : ''}`}
            >
              <PIcon size={14} style={{ marginRight: 6 }} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Circular Timer Visual */}
      <div className={styles.timerVisualContainer}>
        <svg className={styles.timerSvg} viewBox="0 0 100 100">
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <circle className={styles.timerSvgTrack} cx="50" cy="50" r="45" />
          <circle
            className={styles.timerSvgProgress}
            cx="50"
            cy="50"
            r="45"
            strokeDasharray="282.6"
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: isRunning
                ? 'stroke-dashoffset 1s linear'
                : 'stroke-dashoffset 0.3s ease',
            }}
          />
        </svg>
        <div className={styles.timerTextContainer}>
          <span className={styles.timerPresetName}>{activePreset}</span>
          <span className={styles.timerNumber}>{formatTime(timeLeft)}</span>
          <span className={styles.timerTotalTime}>of {Math.round(duration / 60)}m</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.timerControls}>
        <button
          type="button"
          onClick={toggleRunning}
          className={`${styles.controlBtn} ${isRunning ? styles.pauseBtn : styles.startBtn}`}
        >
          {isRunning ? (
            <>
              <Pause size={16} style={{ marginRight: 6 }} /> Pause
            </>
          ) : (
            <>
              <Play size={16} style={{ marginRight: 6 }} /> Start Focus
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => handlePresetSelect(activePreset, duration / 60)}
          className={`${styles.controlBtn} ${styles.resetBtn}`}
          title="Reset Timer"
          aria-label="Reset Timer"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
});

export default FocusTimerCard;
