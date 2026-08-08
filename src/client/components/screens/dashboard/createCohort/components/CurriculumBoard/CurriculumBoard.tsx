"use client";
import Image from 'next/image';

import { useState, type DragEvent, type MouseEvent } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Split,
  Merge,
  Clock,
  BookOpen,
  Award,
  Layers,
} from 'lucide-react';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { useWizardContext } from '../../providers/WizardProvider';
import { CurriculumContextMenu } from '../CurriculumContextMenu/CurriculumContextMenu';
import type { CurriculumLesson, CurriculumSeason } from '@/src/shared/curriculum';

import styles from './CurriculumBoard.module.css';

interface ContextMenuState {
  x: number;
  y: number;
  type: 'season' | 'lesson';
  targetId: string;
}

export function CurriculumBoard() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  const [draggedSeasonId, setDraggedSeasonId] = useState<string | null>(null);
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  if (!curriculum) return null;

  const query = curriculumState.searchQuery.toLowerCase().trim();
  const filterWarning = curriculumState.filterWarningOnly;

  const warningLessonIds = new Set(
    curriculum.warnings.filter((w) => w.lessonId).map((w) => w.lessonId as string),
  );
  const warningSeasonIds = new Set(
    curriculum.warnings.filter((w) => w.seasonId).map((w) => w.seasonId as string),
  );

  const filteredSeasons = curriculum.seasons
    .map((season) => {
      const matchSeasonName = season.title.toLowerCase().includes(query);
      const matchingLessons = season.lessons.filter((lesson) => {
        const matchLesson =
          lesson.title.toLowerCase().includes(query) ||
          lesson.description.toLowerCase().includes(query) ||
          lesson.tags.some((t) => t.toLowerCase().includes(query));
        const matchWarning = !filterWarning || warningLessonIds.has(lesson.id);
        return (query ? matchLesson || matchSeasonName : true) && matchWarning;
      });

      const showSeason = query ? matchSeasonName || matchingLessons.length > 0 : true;
      const warningCheck = !filterWarning || warningSeasonIds.has(season.id) || matchingLessons.length > 0;

      return showSeason && warningCheck ? { ...season, lessons: matchingLessons } : null;
    })
    .filter(Boolean) as CurriculumSeason[];

  // Season Drag handlers
  const handleSeasonDragStart = (e: DragEvent, seasonId: string) => {
    e.stopPropagation();
    setDraggedSeasonId(seasonId);
    e.dataTransfer.setData('text/season-id', seasonId);
  };

  const handleSeasonDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleSeasonDrop = (e: DragEvent, targetSeasonId: string) => {
    e.preventDefault();
    const sourceSeasonId = e.dataTransfer.getData('text/season-id');
    if (sourceSeasonId && sourceSeasonId !== targetSeasonId) {
      actions.moveSeason(sourceSeasonId, targetSeasonId);
    }
    setDraggedSeasonId(null);
  };

  // Lesson Drag handlers
  const handleLessonDragStart = (e: DragEvent, lessonId: string) => {
    e.stopPropagation();
    setDraggedLessonId(lessonId);
    e.dataTransfer.setData('text/lesson-id', lessonId);
  };

  const handleLessonDrop = (e: DragEvent, targetSeasonId: string, targetLessonId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceLessonId = e.dataTransfer.getData('text/lesson-id');
    if (sourceLessonId) {
      actions.moveLesson(sourceLessonId, targetSeasonId, targetLessonId);
    }
    setDraggedLessonId(null);
  };

  // Context menu handler
  const handleContextMenu = (e: MouseEvent, type: 'season' | 'lesson', targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, targetId });
  };

  const { selectedLessonIds, selectedSeasonIds } = curriculumState.multiSelection;

  return (
    <>
      <div className={styles.board}>
        {filteredSeasons.map((season, seasonIndex) => {
          const isSelectedSeason =
            curriculumState.selectedSeasonId === season.id || selectedSeasonIds.includes(season.id);
          const nextSeason = curriculum.seasons[seasonIndex + 1];

          return (
            <div
              key={season.id}
              draggable
              onDragStart={(e) => handleSeasonDragStart(e, season.id)}
              onDragOver={handleSeasonDragOver}
              onDrop={(e) => handleSeasonDrop(e, season.id)}
              onContextMenu={(e) => handleContextMenu(e, 'season', season.id)}
              className={`${styles.seasonCard} ${isSelectedSeason ? styles.seasonCardSelected : ''} ${
                draggedSeasonId === season.id ? styles.seasonCardDragging : ''
              }`}
              onClick={(e) => {
                actions.toggleSelectSeason(season.id, e.shiftKey || e.metaKey || e.ctrlKey);
              }}
            >
              {/* Season Header */}
              <div className={styles.seasonHeader}>
                <div className={styles.seasonHeaderLeft}>
                  <input
                    type="checkbox"
                    checked={selectedSeasonIds.includes(season.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      actions.toggleSelectSeason(season.id, true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.checkbox}
                  />

                  <span className={styles.dragHandle} title="Drag to reorder season">
                    <GripVertical size={16} />
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.toggleSeasonCollapse(season.id);
                    }}
                    className={styles.collapseBtn}
                  >
                    {season.collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>

                  <div className={styles.seasonTitleGroup}>
                    <input
                      type="text"
                      value={season.title}
                      onChange={(e) => actions.updateSeason(season.id, { title: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.seasonTitleInput}
                    />

                    <div className={styles.badgeGroup}>
                      <Badge variant="neutral" size="sm">
                        <BookOpen size={12} style={{ marginRight: 4 }} />
                        {season.lessonCount} lessons
                      </Badge>
                      <Badge variant="brand" size="sm">
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {season.estimatedDuration}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className={styles.seasonHeaderRight} onClick={(e) => e.stopPropagation()}>
                  {season.lessons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => actions.splitSeason(season.id)}
                      className={styles.seasonActionBtn}
                      title="Split season"
                    >
                      <Split size={13} />
                      Split
                    </button>
                  )}

                  {nextSeason && (
                    <button
                      type="button"
                      onClick={() => actions.mergeSeasons(season.id, nextSeason.id)}
                      className={styles.seasonActionBtn}
                      title={`Merge with ${nextSeason.title}`}
                    >
                      <Merge size={13} />
                      Merge
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => actions.duplicateSeason(season.id)}
                    className={styles.seasonActionBtn}
                    title="Duplicate season"
                  >
                    <Copy size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => actions.deleteSeason(season.id)}
                    className={`${styles.seasonActionBtn} ${styles.deleteActionBtn}`}
                    title="Delete season"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Lesson List */}
              {!season.collapsed && (
                <div
                  className={styles.lessonList}
                  onDragOver={handleSeasonDragOver}
                  onDrop={(e) => handleLessonDrop(e, season.id)}
                >
                  {season.lessons.length === 0 ? (
                    <div className={styles.emptySeasonNotice}>
                      Empty season. Drag lessons here or add a new lesson.
                    </div>
                  ) : (
                    season.lessons.map((lesson) => {
                      const isSelectedLesson =
                        curriculumState.selectedLessonId === lesson.id ||
                        selectedLessonIds.includes(lesson.id);

                      return (
                        <div
                          key={lesson.id}
                          draggable
                          onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
                          onDragOver={handleSeasonDragOver}
                          onDrop={(e) => handleLessonDrop(e, season.id, lesson.id)}
                          onContextMenu={(e) => handleContextMenu(e, 'lesson', lesson.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.toggleSelectLesson(lesson.id, e.shiftKey || e.metaKey || e.ctrlKey);
                          }}
                          className={`${styles.lessonCard} ${
                            isSelectedLesson ? styles.lessonCardSelected : ''
                          } ${draggedLessonId === lesson.id ? styles.lessonCardDragging : ''}`}
                        >
                          <div className={styles.lessonMain}>
                            <input
                              type="checkbox"
                              checked={selectedLessonIds.includes(lesson.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                actions.toggleSelectLesson(lesson.id, true);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={styles.checkbox}
                            />

                            <span
                              className={styles.dragHandle}
                              title="Drag lesson to reorder or move to another season"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={16} />
                            </span>

                            <Image fill
                              src={
                                lesson.thumbnail ||
                                (lesson.videoId ? `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg` : undefined) ||
                                '/mock/thumbnails/docker.avif'
                              }
                              alt={lesson.title}
                              className={styles.lessonThumbnail}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (lesson.videoId && !target.src.includes(lesson.videoId)) {
                                  target.src = `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg`;
                                } else {
                                  target.src = '/mock/thumbnails/docker.avif';
                                }
                              }}
                            />

                            <div className={styles.lessonContent}>
                              <div className={styles.lessonTitleRow}>
                                <h4 className={styles.lessonTitle}>{lesson.title}</h4>

                                <div onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => actions.duplicateLesson(lesson.id)}
                                    className={styles.seasonActionBtn}
                                    title="Duplicate lesson"
                                  >
                                    <Copy size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => actions.deleteLesson(lesson.id)}
                                    className={`${styles.seasonActionBtn} ${styles.deleteActionBtn}`}
                                    title="Delete lesson"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <p className={styles.lessonDescription}>{lesson.description}</p>

                              <div className={styles.lessonMetaRow}>
                                <span className={styles.metaTag}>
                                  <Clock size={11} /> {lesson.duration}
                                </span>
                                <span className={styles.metaTag}>
                                  <Layers size={11} /> {lesson.chunkCount} chunks
                                </span>
                                <span className={styles.metaTag}>{lesson.difficulty}</span>
                                <span className={styles.xpBadge}>
                                  <Award size={11} /> {lesson.xp} XP
                                </span>
                                {lesson.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className={styles.metaTag}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Chunk List Preview */}
                          {lesson.chunks && lesson.chunks.length > 0 && (
                            <div className={styles.chunkList}>
                              {lesson.chunks.map((chunk) => (
                                <span key={chunk.id} className={styles.chunkPill}>
                                  {chunk.title} ({chunk.duration})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <CurriculumContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          targetId={contextMenu.targetId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
