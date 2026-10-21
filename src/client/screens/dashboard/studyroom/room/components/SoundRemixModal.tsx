'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AudioLines,
  Ban,
  Check,
  CloudRain,
  Coffee,
  Flame,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trees,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import type { AmbientPresetId, SharedEnvironmentActions, SharedRoomEnvironment } from '../../types';
import { AMBIENT_PRESETS } from '../../data/ambientCatalog';
import styles from './SoundRemixModal.module.css';

export interface AmbientLayerItem {
  id: string;
  presetId?: AmbientPresetId;
  label: string;
  iconName: 'Flame' | 'CloudRain' | 'Coffee' | 'AudioLines' | 'Trees' | 'Waves' | 'Wind';
  image: string;
  volume: number; // 0..100
  muted?: boolean;
}

export interface SoundRemixModalProps {
  isOpen?: boolean;
  onClose: () => void;
  environment?: SharedRoomEnvironment;
  actions?: Pick<
    SharedEnvironmentActions,
    'setAmbiencePreset' | 'setAmbiencePlaying' | 'setAmbienceVolume'
  >;
  initialPresetId?: string | null;
  initialLayers?: AmbientLayerItem[];
  onSelectPreset?: (presetId: AmbientPresetId | null) => void;
  onVolumeChange?: (volume: number) => void;
  onSeeAllPresets?: () => void;
}

const DEFAULT_LAYERS: AmbientLayerItem[] = [
  {
    id: 'fireplace',
    presetId: 'fireplace',
    label: 'Fireplace',
    iconName: 'Flame',
    image: '/images/studyrooms/scenes/fireplace.webp',
    volume: 60,
    muted: false,
  },
  {
    id: 'rain',
    presetId: 'rain',
    label: 'Rain on windows',
    iconName: 'CloudRain',
    image: '/images/studyrooms/scenes/rain.webp',
    volume: 40,
    muted: false,
  },
  {
    id: 'cafe',
    presetId: 'cafe',
    label: 'Café ambiance',
    iconName: 'Coffee',
    image: '/images/studyrooms/scenes/cafe.webp',
    volume: 25,
    muted: false,
  },
  {
    id: 'white-noise',
    presetId: 'white-noise',
    label: 'White noise',
    iconName: 'AudioLines',
    image: '/images/studyrooms/scenes/night-sky.webp',
    volume: 10,
    muted: false,
  },
];

interface PresetOption {
  id: string | null;
  ambientId: AmbientPresetId | null;
  label: string;
  image: string | null;
}

const QUICK_PRESETS: readonly PresetOption[] = [
  {
    id: 'none',
    ambientId: null,
    label: 'None',
    image: null,
  },
  {
    id: 'fireplace',
    ambientId: 'fireplace',
    label: 'Fireplace',
    image: '/images/studyrooms/scenes/fireplace.webp',
  },
  {
    id: 'rain',
    ambientId: 'rain',
    label: 'Rain',
    image: '/images/studyrooms/scenes/rain.webp',
  },
  {
    id: 'cafe',
    ambientId: 'cafe',
    label: 'Cafe',
    image: '/images/studyrooms/scenes/cafe.webp',
  },
  {
    id: 'forest',
    ambientId: 'forest',
    label: 'Forest',
    image: '/images/studyrooms/scenes/forest.webp',
  },
  {
    id: 'ocean',
    ambientId: 'ocean-waves',
    label: 'Ocean',
    image: '/images/studyrooms/scenes/seaside.webp',
  },
  {
    id: 'night',
    ambientId: 'white-noise',
    label: 'Night',
    image: '/images/studyrooms/scenes/night-sky.webp',
  },
] as const;

function getLayerIcon(iconName: AmbientLayerItem['iconName']) {
  switch (iconName) {
    case 'Flame':
      return <Flame size={15} aria-hidden="true" />;
    case 'CloudRain':
      return <CloudRain size={15} aria-hidden="true" />;
    case 'Coffee':
      return <Coffee size={15} aria-hidden="true" />;
    case 'AudioLines':
      return <AudioLines size={15} aria-hidden="true" />;
    case 'Trees':
      return <Trees size={15} aria-hidden="true" />;
    case 'Waves':
      return <Waves size={15} aria-hidden="true" />;
    case 'Wind':
      return <Wind size={15} aria-hidden="true" />;
    default:
      return <AudioLines size={15} aria-hidden="true" />;
  }
}

function getLayerIconColor(iconName: AmbientLayerItem['iconName']): string {
  switch (iconName) {
    case 'Flame':
      return '#f97316'; // orange-500
    case 'CloudRain':
      return '#38bdf8'; // sky-400
    case 'Coffee':
      return '#f59e0b'; // amber-500
    case 'AudioLines':
      return '#94a3b8'; // slate-400
    case 'Trees':
      return '#34d399'; // emerald-400
    case 'Waves':
      return '#60a5fa'; // blue-400
    case 'Wind':
      return '#a78bfa'; // violet-400
    default:
      return '#94a3b8';
  }
}

export function SoundRemixModal({
  isOpen = true,
  onClose,
  environment,
  actions,
  initialPresetId,
  initialLayers,
  onSelectPreset,
  onVolumeChange,
  onSeeAllPresets,
}: SoundRemixModalProps) {
  // Modal container ref for focus trapping or click-outside
  const modalRef = useRef<HTMLDivElement>(null);

  // Active preset selection: defaults to 'fireplace' as shown in the mockup
  const [activePresetId, setActivePresetId] = useState<string | null>(() => {
    if (initialPresetId !== undefined) return initialPresetId;
    if (environment?.ambience.presetId) return environment.ambience.presetId;
    return 'fireplace';
  });

  // Master / Now playing state
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (environment) return environment.ambience.isPlaying;
    return true;
  });

  const [masterVolume, setMasterVolume] = useState<number>(() => {
    if (environment) return environment.ambience.volume;
    return 70;
  });

  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);

  // Ambient layered sliders
  const [layers, setLayers] = useState<AmbientLayerItem[]>(() => {
    return initialLayers && initialLayers.length > 0 ? initialLayers : DEFAULT_LAYERS;
  });

  // Add layer menu toggle
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  // Determine current Now Playing display
  const activePreset = QUICK_PRESETS.find((p) => p.id === activePresetId);
  const nowPlayingTitle =
    activePresetId === 'none' || !activePresetId
      ? 'No Sound Playing'
      : `${activePreset?.label ?? 'Fireplace'} Ambience`;

  const nowPlayingImage =
    activePreset?.image ?? '/images/studyrooms/scenes/fireplace.webp';

  // Toggle master play/pause
  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    actions?.setAmbiencePlaying(nextState);
  };

  // Previous / Next preset in Now playing
  const handleCyclePreset = (step: number) => {
    const presetsWithSound = QUICK_PRESETS.filter((p) => p.id !== 'none');
    const currentIndex = presetsWithSound.findIndex((p) => p.id === activePresetId);
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + step + presetsWithSound.length) % presetsWithSound.length;
    handleSelectPreset(presetsWithSound[nextIndex].id);
  };

  // Toggle master mute
  const handleToggleMasterMute = () => {
    setIsMasterMuted((prev) => !prev);
  };

  // Master volume change
  const handleMasterVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setMasterVolume(clamped);
    if (isMasterMuted && clamped > 0) {
      setIsMasterMuted(false);
    }
    actions?.setAmbienceVolume(clamped);
    onVolumeChange?.(clamped);
  };

  // Layer volume change
  const handleLayerVolumeChange = (layerId: string, vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId
          ? { ...layer, volume: clamped, muted: clamped === 0 ? true : false }
          : layer
      )
    );
  };

  // Layer mute toggle
  const handleToggleLayerMute = (layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, muted: !layer.muted } : layer
      )
    );
  };

  // Remove layer
  const handleRemoveLayer = (layerId: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  };

  // Add layer from menu
  const handleAddLayer = (preset: (typeof AMBIENT_PRESETS)[number]) => {
    const iconName = (preset.icon in {
      Flame: 1,
      CloudRain: 1,
      Coffee: 1,
      AudioLines: 1,
      Trees: 1,
      Waves: 1,
      Wind: 1,
    }
      ? preset.icon
      : 'AudioLines') as AmbientLayerItem['iconName'];

    const newLayer: AmbientLayerItem = {
      id: preset.id,
      presetId: preset.id as AmbientPresetId,
      label: preset.label,
      iconName,
      image: '/images/studyrooms/scenes/night-sky.webp',
      volume: 30,
      muted: false,
    };

    setLayers((prev) => [...prev, newLayer]);
    setShowAddMenu(false);
  };

  // Select quick preset
  const handleSelectPreset = (presetId: string | null) => {
    setActivePresetId(presetId);

    const presetOption = QUICK_PRESETS.find((p) => p.id === presetId);
    const ambientId = presetOption ? presetOption.ambientId : null;

    if (presetId === 'none' || ambientId === null) {
      setIsPlaying(false);
      actions?.setAmbiencePreset(null);
      onSelectPreset?.(null);
    } else {
      setIsPlaying(true);
      actions?.setAmbiencePreset(ambientId);
      onSelectPreset?.(ambientId);

      // If the selected sound is not currently in the ambient layers list, add/boost it
      setLayers((prev) => {
        const existing = prev.find((l) => l.id === presetId || l.presetId === ambientId);
        if (existing) {
          return prev.map((l) =>
            l.id === existing.id ? { ...l, volume: Math.max(l.volume, 50), muted: false } : l
          );
        }
        return prev;
      });
    }
  };

  // Available unused presets for "+ Add layer"
  const availableToAdd = AMBIENT_PRESETS.filter(
    (p) => !layers.some((l) => l.id === p.id || l.presetId === p.id)
  );

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      data-testid="sound-remix-overlay"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sound-remix-title"
        className={styles.modal}
        data-testid="sound-remix-modal"
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconBox} aria-hidden="true">
              <AudioLines size={22} className={styles.headerIcon} />
            </div>
            <div className={styles.headerTitles}>
              <h2 id="sound-remix-title" className={styles.title}>
                Sounds &amp; Music
              </h2>
              <p className={styles.subtitle}>Create your perfect study atmosphere</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Section 1: Now playing » */}
        <section className={styles.section} aria-label="Now playing track">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              Now playing <span className={styles.chevronArrow} aria-hidden="true">»</span>
            </span>
          </div>

          <div className={styles.nowPlayingCard}>
            <div className={styles.trackInfo}>
              <div className={styles.trackThumb}>
                <Image
                  src={nowPlayingImage}
                  alt=""
                  fill
                  sizes="44px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className={styles.trackMeta}>
                <div className={styles.trackName}>{nowPlayingTitle}</div>
                <div className={styles.trackSubtitle}>
                  <span className={styles.brandBadge} aria-hidden="true">
                    U
                  </span>
                  <span>by Undone · 45:12</span>
                </div>
              </div>
            </div>

            <div className={styles.playbackControls}>
              <button
                type="button"
                className={styles.controlBtn}
                aria-label="Previous sound"
                onClick={() => handleCyclePreset(-1)}
              >
                <SkipBack size={15} aria-hidden="true" />
              </button>

              <button
                type="button"
                className={styles.playPauseBtn}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={handleTogglePlay}
              >
                {isPlaying ? (
                  <Pause size={14} fill="#0b0f19" strokeWidth={0} aria-hidden="true" />
                ) : (
                  <Play
                    size={14}
                    fill="#0b0f19"
                    strokeWidth={0}
                    aria-hidden="true"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </button>

              <button
                type="button"
                className={styles.controlBtn}
                aria-label="Next sound"
                onClick={() => handleCyclePreset(1)}
              >
                <SkipForward size={15} aria-hidden="true" />
              </button>

              <button
                type="button"
                className={styles.controlBtn}
                aria-label={isMasterMuted ? 'Unmute master' : 'Mute master'}
                onClick={handleToggleMasterMute}
              >
                {isMasterMuted || masterVolume === 0 ? (
                  <VolumeX size={16} aria-hidden="true" />
                ) : (
                  <Volume2 size={16} aria-hidden="true" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={100}
                value={isMasterMuted ? 0 : masterVolume}
                onChange={(e) => handleMasterVolumeChange(Number(e.target.value))}
                className={styles.masterSlider}
                aria-label="Now playing volume"
                style={
                  {
                    '--fill-percent': `${isMasterMuted ? 0 : masterVolume}%`,
                  } as React.CSSProperties
                }
              />

              <span className={styles.volumePercent}>
                {isMasterMuted ? '0%' : `${masterVolume}%`}
              </span>

              <button
                type="button"
                className={styles.optionsBtn}
                aria-label="More options for now playing"
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Ambient layers 🎚 */}
        <section className={styles.section} aria-label="Ambient layers">
          <div className={styles.layersHeader}>
            <span className={styles.sectionTitle}>
              Ambient layers <span className={styles.sliderIcon} aria-hidden="true">🎚</span>
            </span>

            <button
              type="button"
              className={styles.addLayerBtn}
              onClick={() => setShowAddMenu((prev) => !prev)}
              aria-expanded={showAddMenu}
              aria-label="Add layer"
            >
              <Plus size={13} aria-hidden="true" />
              <span>Add layer</span>
            </button>

            {showAddMenu && (
              <div
                className={styles.addLayerMenu}
                role="menu"
                aria-label="Select layer to add"
              >
                {availableToAdd.length > 0 ? (
                  availableToAdd.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="menuitem"
                      className={styles.addMenuItem}
                      onClick={() => handleAddLayer(preset)}
                    >
                      <span>{preset.label}</span>
                      <Plus size={12} aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <div className={styles.addMenuItem} style={{ opacity: 0.6 }}>
                    All layers added
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.layersList}>
            {layers.map((layer) => {
              const currentVol = layer.muted ? 0 : layer.volume;
              return (
                <div
                  key={layer.id}
                  className={`${styles.layerRow} ${layer.muted ? styles.layerMuted : ''}`}
                  data-testid={`ambient-layer-${layer.id}`}
                >
                  <div
                    className={styles.layerThumb}
                    onClick={() => handleToggleLayerMute(layer.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Mute or unmute ${layer.label}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleLayerMute(layer.id);
                      }
                    }}
                  >
                    <Image
                      src={layer.image}
                      alt=""
                      fill
                      sizes="38px"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>

                  <div className={styles.layerInfo}>
                    <span
                      className={styles.layerIcon}
                      style={{ color: getLayerIconColor(layer.iconName) }}
                      aria-hidden="true"
                    >
                      {getLayerIcon(layer.iconName)}
                    </span>
                    <span className={styles.layerLabel} title={layer.label}>
                      {layer.label}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={currentVol}
                    onChange={(e) =>
                      handleLayerVolumeChange(layer.id, Number(e.target.value))
                    }
                    className={styles.layerSlider}
                    aria-label={`${layer.label} volume`}
                    style={
                      {
                        '--fill-percent': `${currentVol}%`,
                      } as React.CSSProperties
                    }
                  />

                  <span className={styles.layerPercent}>
                    {layer.muted ? '0%' : `${layer.volume}%`}
                  </span>

                  <button
                    type="button"
                    className={styles.layerOptionsBtn}
                    aria-label={`More options for ${layer.label}`}
                  >
                    <MoreHorizontal size={14} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className={styles.layerRemoveBtn}
                    onClick={() => handleRemoveLayer(layer.id)}
                    aria-label={`Remove ${layer.label}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Quick presets */}
        <section className={styles.section} aria-label="Quick presets">
          <div className={styles.presetsHeader}>
            <span className={styles.sectionTitle}>Quick presets</span>
            <button
              type="button"
              className={styles.seeAllLink}
              onClick={onSeeAllPresets}
              aria-label="See all presets"
            >
              See all ›
            </button>
          </div>

          <div
            className={styles.presetsStrip}
            role="radiogroup"
            aria-label="Quick ambient presets"
          >
            {QUICK_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id ?? 'none'}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.presetCard} ${
                    isSelected ? styles.presetCardActive : ''
                  }`}
                  onClick={() => handleSelectPreset(preset.id)}
                  aria-label={`Preset ${preset.label}`}
                >
                  <div className={styles.presetThumbBox}>
                    {preset.image ? (
                      <Image
                        src={preset.image}
                        alt=""
                        fill
                        sizes="64px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={styles.noneIconBox}>
                        <Ban size={20} className={styles.noneIcon} aria-hidden="true" />
                      </div>
                    )}
                    {isSelected && (
                      <div className={styles.checkBadge} aria-hidden="true">
                        <Check size={10} color="#ffffff" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <span className={styles.presetName}>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default SoundRemixModal;
