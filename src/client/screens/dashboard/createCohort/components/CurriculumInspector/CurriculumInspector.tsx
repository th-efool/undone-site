"use client";
import Image from 'next/image';

import { useState } from 'react';
import { X, Layers, BookOpen, Plus, Compass } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { difficultyOptions, visibilityOptions } from '../../mock/createCohort.mock';

import styles from './CurriculumInspector.module.css';

const DIFF_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const VIS_OPTIONS = ['Public', 'Private', 'Unlisted'] as const;

export function CurriculumInspector() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const [activeTab, setActiveTab] = useState<'general' | 'objectives' | 'resources'>('general');
  const [newTag, setNewTag] = useState('');
  const [newObj, setNewObj] = useState('');
  const [newPrereq, setNewPrereq] = useState('');
  const [targetSeasonHours, setTargetSeasonHours] = useState(10);

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
          {(['general', 'objectives', 'resources'] as const).map((tab) => (
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

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Difficulty</span>
                </div>
                <div className={styles.pills}>
                  {DIFF_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`${styles.pill} ${selectedLesson.difficulty === opt ? styles.pillActive : styles.pillIdle}`}
                      onClick={() => actions.updateLesson(selectedLesson.id, { difficulty: opt })}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Visibility</span>
                </div>
                <div className={styles.pills}>
                  {VIS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`${styles.pill} ${(selectedLesson.visibility || 'Public') === opt ? styles.pillActive : styles.pillIdle}`}
                      onClick={() => actions.updateLesson(selectedLesson.id, { visibility: opt })}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
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

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Description</span>
                </div>
                <textarea
                  value={selectedLesson.description}
                  onChange={(e) => actions.updateLesson(selectedLesson.id, { description: e.target.value })}
                  className={`${styles.input} ${styles.textarea}`}
                />
              </section>
            </>
          )}

          {activeTab === 'objectives' && (
            <>
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Learning Objectives</span>
                </div>
                <div className={styles.itemList}>
                  {(selectedLesson.learningObjectives || []).map((obj, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <span>{obj}</span>
                      <button
                        type="button"
                        className={styles.removeTagBtn}
                        onClick={() =>
                          actions.updateLesson(selectedLesson.id, {
                            learningObjectives: (selectedLesson.learningObjectives || []).filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className={styles.addRowGroup}>
                  <input
                    type="text"
                    placeholder="Add objective..."
                    value={newObj}
                    onChange={(e) => setNewObj(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newObj.trim()) {
                        actions.updateLesson(selectedLesson.id, {
                          learningObjectives: [...(selectedLesson.learningObjectives || []), newObj.trim()],
                        });
                        setNewObj('');
                      }
                    }}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => {
                      if (newObj.trim()) {
                        actions.updateLesson(selectedLesson.id, {
                          learningObjectives: [...(selectedLesson.learningObjectives || []), newObj.trim()],
                        });
                        setNewObj('');
                      }
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Prerequisites</span>
                </div>
                <div className={styles.itemList}>
                  {(selectedLesson.prerequisites || []).map((req, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <span>{req}</span>
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
                  ))}
                </div>
                <div className={styles.addRowGroup}>
                  <input
                    type="text"
                    placeholder="Add prerequisite..."
                    value={newPrereq}
                    onChange={(e) => setNewPrereq(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPrereq.trim()) {
                        actions.updateLesson(selectedLesson.id, {
                          prerequisites: [...(selectedLesson.prerequisites || []), newPrereq.trim()],
                        });
                        setNewPrereq('');
                      }
                    }}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => {
                      if (newPrereq.trim()) {
                        actions.updateLesson(selectedLesson.id, {
                          prerequisites: [...(selectedLesson.prerequisites || []), newPrereq.trim()],
                        });
                        setNewPrereq('');
                      }
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === 'resources' && (
            <>
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Tags</span>
                </div>
                <div className={styles.tagGroup}>
                  {selectedLesson.tags.map((tag, index) => (
                    <span key={index} className={styles.tagPill}>
                      #{tag}
                      <button
                        type="button"
                        className={styles.removeTagBtn}
                        onClick={() =>
                          actions.updateLesson(selectedLesson.id, {
                            tags: selectedLesson.tags.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className={styles.addRowGroup}>
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTag.trim()) {
                        actions.updateLesson(selectedLesson.id, { tags: [...selectedLesson.tags, newTag.trim()] });
                        setNewTag('');
                      }
                    }}
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => {
                      if (newTag.trim()) {
                        actions.updateLesson(selectedLesson.id, { tags: [...selectedLesson.tags, newTag.trim()] });
                        setNewTag('');
                      }
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <BookOpen size={14} className={styles.icon} />
                  <span className={styles.sectionLabel}>Creator Notes</span>
                </div>
                <textarea
                  placeholder="Private notes..."
                  value={selectedLesson.notes || ''}
                  onChange={(e) => actions.updateLesson(selectedLesson.id, { notes: e.target.value })}
                  className={`${styles.input} ${styles.textarea}`}
                />
              </section>
            </>
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
