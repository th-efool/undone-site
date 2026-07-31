'use client';

import { useState } from 'react';
import { X, Sliders, Layers, BookOpen, Plus, Compass, ListChecks } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { difficultyOptions, visibilityOptions } from '../../mock/createCohort.mock';

import styles from './CurriculumInspector.module.css';

export function CurriculumInspector() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const [activeTab, setActiveTab] = useState<'general' | 'objectives' | 'resources'>('general');
  const [newTag, setNewTag] = useState('');
  const [newObj, setNewObj] = useState('');
  const [newPrereq, setNewPrereq] = useState('');

  if (!curriculum) return null;

  const selectedSeason = curriculumState.selectedSeasonId
    ? curriculum.seasons.find((s) => s.id === curriculumState.selectedSeasonId)
    : null;

  let selectedLesson = null;
  if (curriculumState.selectedLessonId) {
    for (const season of curriculum.seasons) {
      const found = season.lessons.find((l) => l.id === curriculumState.selectedLessonId);
      if (found) {
        selectedLesson = found;
        break;
      }
    }
  }

  // Root Curriculum / Journey Level Inspector (when no season or lesson selected)
  if (!selectedSeason && !selectedLesson) {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Compass size={16} color="#6366f1" />
            <span className={styles.headerTitle}>Journey Metadata</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Journey Name</label>
          <input
            type="text"
            value={curriculum.title}
            onChange={(e) => actions.updateCurriculumMeta({ title: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Journey Description</label>
          <textarea
            value={curriculum.description}
            onChange={(e) => actions.updateCurriculumMeta({ description: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Primary Language</label>
          <input
            type="text"
            value={curriculum.primaryLanguage || 'English'}
            onChange={(e) => actions.updateCurriculumMeta({ primaryLanguage: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Target Audience</label>
          <input
            type="text"
            placeholder="e.g. Knowledge workers & ambitious creators"
            value={curriculum.targetAudience || ''}
            onChange={(e) => actions.updateCurriculumMeta({ targetAudience: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Required Experience</label>
          <input
            type="text"
            placeholder="e.g. Basic familiarization with focus apps"
            value={curriculum.requiredExperience || ''}
            onChange={(e) => actions.updateCurriculumMeta({ requiredExperience: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Creator Notes</label>
          <textarea
            placeholder="Internal notes for cohort deployment..."
            value={curriculum.creatorNotes || ''}
            onChange={(e) => actions.updateCurriculumMeta({ creatorNotes: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>
      </div>
    );
  }

  // Lesson Inspector (with Multi-Tab)
  if (selectedLesson) {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <BookOpen size={16} color="#6366f1" />
            <span className={styles.headerTitle}>Lesson Inspector</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={() => actions.selectLesson(null)}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'objectives' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('objectives')}
          >
            Objectives
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'resources' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('resources')}
          >
            Resources
          </button>
        </div>

        {activeTab === 'general' && (
          <>
            <img
              src={selectedLesson.thumbnail || '/images/landing/screen.webp'}
              alt={selectedLesson.title}
              className={styles.imagePreview}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/landing/screen.webp';
              }}
            />

            <div className={styles.field}>
              <label className={styles.label}>Thumbnail URL</label>
              <input
                type="text"
                value={selectedLesson.thumbnail}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { thumbnail: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Lesson Title</label>
              <input
                type="text"
                value={selectedLesson.title}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { title: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Subtitle</label>
              <input
                type="text"
                placeholder="Short tagline..."
                value={selectedLesson.subtitle || ''}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { subtitle: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea
                value={selectedLesson.description}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { description: e.target.value })}
                className={`${styles.input} ${styles.textarea}`}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Duration</label>
              <input
                type="text"
                value={selectedLesson.duration}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { duration: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Difficulty</label>
              <select
                value={selectedLesson.difficulty}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { difficulty: e.target.value })}
                className={styles.select}
              >
                {difficultyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Visibility</label>
              <select
                value={selectedLesson.visibility || 'Public'}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { visibility: e.target.value })}
                className={styles.select}
              >
                {visibilityOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>XP Reward</label>
              <input
                type="number"
                value={selectedLesson.xp}
                onChange={(e) =>
                  actions.updateLesson(selectedLesson.id, { xp: Math.max(0, Number(e.target.value)) })
                }
                className={styles.input}
              />
            </div>
          </>
        )}

        {activeTab === 'objectives' && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Learning Objectives</label>
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

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Add objective..."
                  value={newObj}
                  onChange={(e) => setNewObj(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newObj.trim()) {
                      actions.updateLesson(selectedLesson.id, {
                        learningObjectives: [...(selectedLesson.learningObjectives || []), newObj.trim()],
                      });
                      setNewObj('');
                    }
                  }}
                  className={styles.input}
                  style={{ width: 'auto', cursor: 'pointer' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Prerequisites</label>
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

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Add prerequisite..."
                  value={newPrereq}
                  onChange={(e) => setNewPrereq(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPrereq.trim()) {
                      actions.updateLesson(selectedLesson.id, {
                        prerequisites: [...(selectedLesson.prerequisites || []), newPrereq.trim()],
                      });
                      setNewPrereq('');
                    }
                  }}
                  className={styles.input}
                  style={{ width: 'auto', cursor: 'pointer' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Completion Message</label>
              <textarea
                placeholder="Message shown when creator finishes lesson..."
                value={selectedLesson.completionMessage || ''}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { completionMessage: e.target.value })}
                className={`${styles.input} ${styles.textarea}`}
              />
            </div>
          </>
        )}

        {activeTab === 'resources' && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Tags</label>
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
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className={styles.input}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTag.trim()) {
                      actions.updateLesson(selectedLesson.id, {
                        tags: [...selectedLesson.tags, newTag.trim()],
                      });
                      setNewTag('');
                    }
                  }}
                  className={styles.input}
                  style={{ width: 'auto', cursor: 'pointer' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Creator Notes</label>
              <textarea
                placeholder="Private creator notes for this lesson..."
                value={selectedLesson.notes || ''}
                onChange={(e) => actions.updateLesson(selectedLesson.id, { notes: e.target.value })}
                className={`${styles.input} ${styles.textarea}`}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Season Inspector
  if (selectedSeason) {
    return (
      <div className={styles.inspector}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Layers size={16} color="#6366f1" />
            <span className={styles.headerTitle}>Season Inspector</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={() => actions.selectSeason(null)}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Season Title</label>
          <input
            type="text"
            value={selectedSeason.title}
            onChange={(e) => actions.updateSeason(selectedSeason.id, { title: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Subtitle</label>
          <input
            type="text"
            placeholder="Season tagline..."
            value={selectedSeason.subtitle || ''}
            onChange={(e) => actions.updateSeason(selectedSeason.id, { subtitle: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            value={selectedSeason.description}
            onChange={(e) => actions.updateSeason(selectedSeason.id, { description: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Season Completion Message</label>
          <textarea
            placeholder="Message shown when season is complete..."
            value={selectedSeason.seasonCompletionMessage || ''}
            onChange={(e) => actions.updateSeason(selectedSeason.id, { seasonCompletionMessage: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>
      </div>
    );
  }

  return null;
}
