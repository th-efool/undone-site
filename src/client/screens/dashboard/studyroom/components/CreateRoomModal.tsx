'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Loader2, Sparkles } from 'lucide-react';
import { SCENE_BACKGROUNDS } from '../data/backgroundCatalog';
import { STUDY_ROOM_LIMITS, type RoomScopeKind, type RoomListing } from '@/src/shared/studyroom/contracts';
import styles from './CreateRoomModal.module.css';

export interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated?: (room: { id: string; slug: string; title: string }) => void;
}

export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scopeKind, setScopeKind] = useState<RoomScopeKind>('STANDALONE');
  const [cohortId, setCohortId] = useState('');
  const [listing, setListing] = useState<RoomListing>('LISTED');
  const [capacity, setCapacity] = useState<number>(STUDY_ROOM_LIMITS.CAPACITY_DEFAULT);
  const [tagsInput, setTagsInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [visualPresetId, setVisualPresetId] = useState('library');

  const [cohorts, setCohorts] = useState<Array<{ id: string; title: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch eligible cohorts for creation
  useEffect(() => {
    if (isOpen) {
      fetch('/api/studyroom/cohorts')
        .then((res) => (res.ok ? res.json() : { cohorts: [] }))
        .then((data) => {
          setCohorts(data.cohorts || []);
          if (data.cohorts && data.cohorts.length > 0) {
            setCohortId((prev) => prev || data.cohorts[0].id);
          }
        })
        .catch(() => setCohorts([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (publishImmediately: boolean) => {
    setErrorMessage(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH) {
      setErrorMessage(`Title must be at least ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} character.`);
      return;
    }

    if (scopeKind === 'COHORT' && !cohortId) {
      setErrorMessage('Please select a cohort for cohort-scoped room.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, STUDY_ROOM_LIMITS.TAGS_MAX_COUNT);

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'req-' + Math.random().toString(36).slice(2);

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/studyroom/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          title: cleanTitle,
          description: description.trim() || undefined,
          scopeKind,
          cohortId: scopeKind === 'COHORT' ? cohortId : undefined,
          listing,
          capacity,
          tags,
          language,
          visualPresetId,
          publishImmediately,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to create room.');
        setIsSubmitting(false);
        return;
      }

      onClose();
      if (onRoomCreated) {
        onRoomCreated(data);
      }

      if (publishImmediately && data.slug) {
        router.push(`/studyroom/${data.slug}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error occurred while creating study room.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="create-room-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="create-room-title" className={styles.title}>
            Create Study Room
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {errorMessage && (
            <div className={styles.errorBanner} role="alert">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div className={styles.formGroup}>
            <label htmlFor="room-title-input" className={styles.label}>
              <span>Room Title *</span>
              <span className={styles.charCount}>
                {title.length}/{STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH}
              </span>
            </label>
            <input
              id="room-title-input"
              type="text"
              className={styles.input}
              placeholder="e.g. Quiet Calculus Lounge"
              maxLength={STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label htmlFor="room-description-input" className={styles.label}>
              <span>Atmosphere & Goals</span>
              <span className={styles.charCount}>
                {description.length}/{STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH}
              </span>
            </label>
            <textarea
              id="room-description-input"
              className={styles.textarea}
              placeholder="Brief overview of focus rules or quiet expectations..."
              maxLength={STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Scope and Listing */}
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="room-scope-select" className={styles.label}>
                <span>Scope</span>
              </label>
              <select
                id="room-scope-select"
                className={styles.select}
                value={scopeKind}
                onChange={(e) => setScopeKind(e.target.value as RoomScopeKind)}
                disabled={isSubmitting}
              >
                <option value="STANDALONE">Public / Standalone</option>
                <option value="COHORT" disabled={cohorts.length === 0}>
                  Cohort-Scoped {cohorts.length === 0 ? '(No Cohorts)' : ''}
                </option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="room-listing-select" className={styles.label}>
                <span>Discovery Listing</span>
              </label>
              <select
                id="room-listing-select"
                className={styles.select}
                value={listing}
                onChange={(e) => setListing(e.target.value as RoomListing)}
                disabled={isSubmitting}
              >
                <option value="LISTED">Listed in Directory</option>
                <option value="UNLISTED">Unlisted (Direct link only)</option>
              </select>
            </div>
          </div>

          {/* Cohort Picker if COHORT scope */}
          {scopeKind === 'COHORT' && cohorts.length > 0 && (
            <div className={styles.formGroup}>
              <label htmlFor="room-cohort-select" className={styles.label}>
                <span>Target Cohort *</span>
              </label>
              <select
                id="room-cohort-select"
                className={styles.select}
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                disabled={isSubmitting}
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Capacity and Language */}
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="room-capacity-input" className={styles.label}>
                <span>Capacity (Seats)</span>
                <span className={styles.charCount}>{capacity} seats</span>
              </label>
              <input
                id="room-capacity-input"
                type="number"
                min={STUDY_ROOM_LIMITS.CAPACITY_MIN}
                max={STUDY_ROOM_LIMITS.CAPACITY_MAX}
                className={styles.input}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || STUDY_ROOM_LIMITS.CAPACITY_DEFAULT)}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="room-language-select" className={styles.label}>
                <span>Language</span>
              </label>
              <select
                id="room-language-select"
                className={styles.select}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className={styles.formGroup}>
            <label htmlFor="room-tags-input" className={styles.label}>
              <span>Tags (comma-separated, max 5)</span>
            </label>
            <input
              id="room-tags-input"
              type="text"
              className={styles.input}
              placeholder="e.g. math, deep-work, lofi"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Visual Preset */}
          <div className={styles.formGroup}>
            <span className={styles.label}>
              <span>Atmosphere & Backdrop</span>
            </span>
            <div className={styles.presetGrid}>
              {SCENE_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setVisualPresetId(bg.id)}
                  className={`${styles.presetItem} ${visualPresetId === bg.id ? styles.presetSelected : ''}`}
                  disabled={isSubmitting}
                >
                  {bg.image && (
                    <Image
                      src={bg.image}
                      alt={bg.label}
                      fill
                      sizes="140px"
                      className={styles.presetImg}
                    />
                  )}
                  <span className={styles.presetLabel}>{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Save Draft'}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={16} />
                <span>Create & Open</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomModal;
