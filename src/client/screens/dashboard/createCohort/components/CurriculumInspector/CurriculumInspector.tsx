"use client";
import Image from 'next/image';

import { useState, useRef, useEffect } from 'react';
import { 
  X, Layers, BookOpen, Compass,
  SignalLow, SignalMedium, SignalHigh, ChevronDown,
  Monitor, Smartphone, Headphones,
  Feather, Brain, Weight,
  Target, Route
} from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumInspector.module.css';

const DIFF_OPTIONS = [
  { value: 'Beginner', label: 'Beginner', icon: SignalLow },
  { value: 'Intermediate', label: 'Intermediate', icon: SignalMedium },
  { value: 'Advanced', label: 'Advanced', icon: SignalHigh },
] as const;

const VISUAL_OPTIONS = [
  { value: 'REQUIRES SCREEN', icon: Monitor },
  { value: 'GLANCEABLE', icon: Smartphone },
  { value: 'AUDIO ONLY', icon: Headphones }
] as const;

const COGNITIVE_OPTIONS = [
  { value: 'LIGHT & BREEZY', icon: Feather },
  { value: 'STANDARD', icon: Brain },
  { value: 'HEAVY / DENSE', icon: Weight }
] as const;

const PATHWAY_OPTIONS = [
  { value: 'CORE CURRICULUM', icon: Target },
  { value: 'BONUS / TANGENT', icon: Route }
] as const;

export function CurriculumInspector() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const [activeTab, setActiveTab] = useState<'general' | 'prerequisites'>('general');
  const [targetSeasonHours, setTargetSeasonHours] = useState(10);
  const [diffOpen, setDiffOpen] = useState(false);
  const diffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (diffRef.current && !diffRef.current.contains(event.target as Node)) {
        setDiffOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!curriculum) return null;

  const selectedSeason = curriculumState.selectedSeasonId
    ? curriculum.seasons.find((s) => s.id === curriculumState.selectedSeasonId)
    : null;

  let selectedLesson = null;
  if (curriculumState.selectedLessonId) {
    for (const season of curriculum.seasons) {
      const found = season.lessons.find((l) => l.id === curriculumState.selectedLessonId);
      if (found) { selectedLesson = found; break; }
    }
  }

  const allLessons = curriculum.seasons.flatMap((s) => s.lessons);

  // ── Journey root inspector ────────────────────────────────────────────────
  if (!selectedSeason && !selectedLesson) {
    return (
      <div className={styles.inspector}>
        <div className={styles.inspectorContent}>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Journey</span>
            </div>
            <label className={styles.fieldLabel}>Name</label>
            <input
              type="text"
              value={curriculum.title}
              onChange={(e) => actions.updateCurriculumMeta({ title: e.target.value })}
              className={styles.input}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Season Volume</span>
            </div>
            <div className={styles.sliderRow}>
              <span
                className={`${styles.sliderEdgeLabel} ${targetSeasonHours === 1 ? styles.sliderEdgeActive : ''}`}
                onClick={() => setTargetSeasonHours(1)}
              >
                1h
              </span>
              <div className={styles.sliderInputWrapper}>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={targetSeasonHours}
                  onChange={(e) => setTargetSeasonHours(Number(e.target.value))}
                  className={styles.rangeSlider}
                />
              </div>
              <span
                className={`${styles.sliderEdgeLabel} ${targetSeasonHours === 20 ? styles.sliderEdgeActive : ''}`}
                onClick={() => setTargetSeasonHours(20)}
              >
                20h
              </span>
            </div>
            <div className={styles.sliderValue}>{targetSeasonHours} hours per season</div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Description</span>
            </div>
            <textarea
              value={curriculum.description}
              onChange={(e) => actions.updateCurriculumMeta({ description: e.target.value })}
              className={`${styles.input} ${styles.textarea}`}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Language</span>
            </div>
            <input
              type="text"
              value={curriculum.primaryLanguage || 'English'}
              onChange={(e) => actions.updateCurriculumMeta({ primaryLanguage: e.target.value })}
              className={styles.input}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Target Audience</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Ambitious developers"
              value={curriculum.targetAudience || ''}
              onChange={(e) => actions.updateCurriculumMeta({ targetAudience: e.target.value })}
              className={styles.input}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Compass size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Creator Notes</span>
            </div>
            <textarea
              placeholder="Internal notes..."
              value={curriculum.creatorNotes || ''}
              onChange={(e) => actions.updateCurriculumMeta({ creatorNotes: e.target.value })}
              className={`${styles.input} ${styles.textarea}`}
            />
          </section>

        </div>
      </div>
    );
  }

  // ── Lesson inspector ──────────────────────────────────────────────────────
  if (selectedLesson) {
    return (
      <div className={styles.inspector}>
        <button type="button" className={styles.closeBtn} onClick={() => actions.selectLesson(null)}>
          <X size={14} />
        </button>

        <div className={styles.tabBar}>
          {(['general', 'prerequisites'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.inspectorContent}>

          {activeTab === 'general' && (
            <>
              <Image
                width={400}
                height={300}
                src={selectedLesson.thumbnail || '/mock/thumbnails/docker.avif'}
                alt={selectedLesson.title}
                className={styles.imagePreview}
                onError={(e) => { (e.target as HTMLImageElement).src = '/mock/thumbnails/docker.avif'; }}
              />

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Lesson</span>
                </div>
                <label className={styles.fieldLabel}>Title</label>
                <input
                  type="text"
                  value={selectedLesson.title}
                  onChange={(e) => actions.updateLesson(selectedLesson.id, { title: e.target.value })}
                  className={styles.input}
                />
              </section>

              <section className={styles.sectionInline}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Difficulty</span>
                </div>
                <div className={styles.dropdownContainer} ref={diffRef}>
                  <button
                    type="button"
                    className={styles.dropdownTrigger}
                    onClick={() => setDiffOpen(!diffOpen)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(() => {
                        const activeOpt = DIFF_OPTIONS.find(o => o.value === selectedLesson.difficulty) || DIFF_OPTIONS[1];
                        const IconComponent = activeOpt.icon;
                        return <><IconComponent size={14} /> {activeOpt.label}</>;
                      })()}
                    </div>
                    <ChevronDown size={14} />
                  </button>
                  {diffOpen && (
                    <div className={styles.dropdownMenu}>
                      {DIFF_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={styles.dropdownItem}
                          onClick={() => {
                            actions.updateLesson(selectedLesson.id, { difficulty: opt.value });
                            setDiffOpen(false);
                          }}
                        >
                          <opt.icon size={14} /> {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.sectionInline}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>XP Reward</span>
                </div>
                <div className={styles.customGoalGroup}>
                  <input
                    type="number"
                    value={selectedLesson.xp}
                    min={0}
                    onChange={(e) => actions.updateLesson(selectedLesson.id, { xp: Math.max(0, Number(e.target.value)) })}
                    className={styles.customGoalInput}
                  />
                  <span className={styles.unitText}>XP</span>
                </div>
              </section>

              <section className={styles.sectionInline}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Vis. Focus</span>
                </div>
                <div className={styles.tabBar} style={{ width: '100%', maxWidth: '200px' }}>
                  {VISUAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.value}
                      className={`${styles.tabBtn} ${selectedLesson.visualDependence === opt.value || (!selectedLesson.visualDependence && opt.value === 'GLANCEABLE') ? styles.tabActive : ''}`}
                      onClick={() => actions.updateLesson(selectedLesson.id, { visualDependence: opt.value })}
                    >
                      <opt.icon size={14} />
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.sectionInline}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Cog. Load</span>
                </div>
                <div className={styles.tabBar} style={{ width: '100%', maxWidth: '200px' }}>
                  {COGNITIVE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.value}
                      className={`${styles.tabBtn} ${selectedLesson.cognitiveLoad === opt.value || (!selectedLesson.cognitiveLoad && opt.value === 'STANDARD') ? styles.tabActive : ''}`}
                      onClick={() => actions.updateLesson(selectedLesson.id, { cognitiveLoad: opt.value })}
                    >
                      <opt.icon size={14} />
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.sectionInline}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Pathway</span>
                </div>
                <div className={styles.tabBar} style={{ width: '100%', maxWidth: '200px' }}>
                  {PATHWAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.value}
                      className={`${styles.tabBtn} ${selectedLesson.pathway === opt.value || (!selectedLesson.pathway && opt.value === 'CORE CURRICULUM') ? styles.tabActive : ''}`}
                      onClick={() => actions.updateLesson(selectedLesson.id, { pathway: opt.value })}
                    >
                      <opt.icon size={14} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === 'prerequisites' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <BookOpen size={14} className={styles.icon} />
                <span className={styles.sectionLabel}>Prerequisites</span>
              </div>
              <div className={styles.itemList}>
                {(selectedLesson.prerequisites || []).map((reqId, idx) => {
                  const reqLesson = allLessons.find((l) => l.id === reqId);
                  return (
                    <div key={idx} className={styles.itemRow}>
                      <span>{reqLesson ? reqLesson.title : reqId}</span>
                      <button
                        type="button"
                        className={styles.removeTagBtn}
                        onClick={() =>
                          actions.updateLesson(selectedLesson.id, {
                            prerequisites: (selectedLesson.prerequisites || []).filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className={styles.addRowGroup}>
                <select
                  className={styles.input}
                  value=""
                  onChange={(e) => {
                    const reqId = e.target.value;
                    if (reqId && !(selectedLesson.prerequisites || []).includes(reqId)) {
                      actions.updateLesson(selectedLesson.id, {
                        prerequisites: [...(selectedLesson.prerequisites || []), reqId],
                      });
                    }
                  }}
                >
                  <option value="" disabled>Add prerequisite...</option>
                  {allLessons
                    .filter((l) => l.id !== selectedLesson.id && !(selectedLesson.prerequisites || []).includes(l.id))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                </select>
              </div>
            </section>
          )}

        </div>
      </div>
    );
  }

  // ── Season inspector ──────────────────────────────────────────────────────
  if (selectedSeason) {
    return (
      <div className={styles.inspector}>
        <button type="button" className={styles.closeBtn} onClick={() => actions.selectSeason(null)}>
          <X size={14} />
        </button>

        <div className={styles.inspectorContent}>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Layers size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Season</span>
            </div>
            <label className={styles.fieldLabel}>Title</label>
            <input
              type="text"
              value={selectedSeason.title}
              onChange={(e) => actions.updateSeason(selectedSeason.id, { title: e.target.value })}
              className={styles.input}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Layers size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Subtitle</span>
            </div>
            <input
              type="text"
              placeholder="Season tagline..."
              value={selectedSeason.subtitle || ''}
              onChange={(e) => actions.updateSeason(selectedSeason.id, { subtitle: e.target.value })}
              className={styles.input}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Layers size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Description</span>
            </div>
            <textarea
              value={selectedSeason.description}
              onChange={(e) => actions.updateSeason(selectedSeason.id, { description: e.target.value })}
              className={`${styles.input} ${styles.textarea}`}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Layers size={14} className={styles.icon} />
              <span className={styles.sectionLabel}>Completion Message</span>
            </div>
            <textarea
              placeholder="Message shown when season is complete..."
              value={selectedSeason.seasonCompletionMessage || ''}
              onChange={(e) => actions.updateSeason(selectedSeason.id, { seasonCompletionMessage: e.target.value })}
              className={`${styles.input} ${styles.textarea}`}
            />
          </section>

        </div>
      </div>
    );
  }

  return null;
}
