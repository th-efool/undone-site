import Link from "next/link";
import { getCohortHref } from "@/src/client/navigation/cohortLinks";
import { Clock3, GripVertical, MoreHorizontal, Pause, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ActiveCohort, PauseOption, Weekday } from "../../models";

import styles from "./ActiveCohortRow.module.css";

const weekdays: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ActiveCohortRowProps {
    item: ActiveCohort;
    pauseOptions: PauseOption[];
    onReorder(draggedId: string, targetId: string): void;
    onUpdateDailyGoal(cohortId: string, minutes: number): void;
    onUpdateSchedule(cohortId: string, days: Weekday[]): void;
    onPause(cohortId: string, days: number, pausedReason?: string): void;
}

export function ActiveCohortRow({
                                    item,
                                    pauseOptions,
                                    onPause,
                                    onReorder,
                                    onUpdateDailyGoal,
                                    onUpdateSchedule,
                                }: ActiveCohortRowProps) {
    const rowRef = useRef<HTMLElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [goalOpen, setGoalOpen] = useState(false);
    const [pauseOpen, setPauseOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [selectedDays, setSelectedDays] = useState<Weekday[]>(item.schedule.days);
    const [goalMinutes, setGoalMinutes] = useState(item.dailyGoalMinutes);
    const [selectedPauseOption, setSelectedPauseOption] = useState(pauseOptions[0]?.id ?? "tomorrow");
    const [customPauseDays, setCustomPauseDays] = useState(10);

    function closeEditors() {
        setScheduleOpen(false);
        setGoalOpen(false);
        setPauseOpen(false);
        setMoreOpen(false);
    }

    useEffect(() => {
        function handlePointerDown(event: MouseEvent) {
            if (!rowRef.current?.contains(event.target as Node)) {
                closeEditors();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeEditors();
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    function toggleScheduleDay(day: Weekday) {
        setSelectedDays((days) => {
            const nextDays = days.includes(day) ? days.filter((itemDay) => itemDay !== day) : [...days, day];
            const safeDays = nextDays.length > 0 ? nextDays : [day];
            onUpdateSchedule(item.id, safeDays);
            return safeDays;
        });
    }

    function saveGoal() {
        onUpdateDailyGoal(item.id, goalMinutes);
        setGoalOpen(false);
    }

    function cancelGoal() {
        setGoalMinutes(item.dailyGoalMinutes);
        setGoalOpen(false);
    }

    function confirmPause() {
        const pauseOption = pauseOptions.find((option) => option.id === selectedPauseOption);
        const days = pauseOption?.days ?? customPauseDays;
        onPause(item.id, days, pauseOption?.label);
        setPauseOpen(false);
    }

    return (
        <article
            ref={rowRef}
            className={`${styles.row} ${isDraggingOver ? styles.dragOver : ""}`}
            draggable
            onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(event) => {
                event.preventDefault();
                setIsDraggingOver(false);
                onReorder(event.dataTransfer.getData("text/plain"), item.id);
            }}
            onDragEnd={() => setIsDraggingOver(false)}
        >
            <GripVertical className={styles.grip} size={18} strokeWidth={2.2} />

            <span className={styles.rank}>{item.rank}</span>

            <Link href={getCohortHref(item.cohortId ?? item.id)}><img className={styles.thumbnail} src={item.thumbnail} alt="" /></Link>

            <div className={styles.course}>
                <h3 className={styles.title}>
                    <Link href={getCohortHref(item.cohortId ?? item.id)}>{item.title}</Link>
                    {item.featured && <Sparkles size={15} strokeWidth={2.5} className={styles.sparkle} />}
                </h3>
                <p className={styles.provider}>{item.provider}</p>
                <p className={styles.today}>{item.minutesToday} min today</p>
            </div>

            <div className={styles.popoverAnchor}>
                <button
                    type="button"
                    className={styles.schedule}
                    onClick={() => {
                        setScheduleOpen((open) => !open);
                        setGoalOpen(false);
                        setPauseOpen(false);
                        setMoreOpen(false);
                    }}
                >
                    <Clock3 size={14} strokeWidth={2.2} />
                    {item.schedule.label}
                </button>

                {scheduleOpen && (
                    <div className={styles.popover} role="dialog" aria-label={`Edit schedule for ${item.title}`}>
                        <div className={styles.dayGrid}>
                            {weekdays.map((day) => (
                                <button
                                    key={day}
                                    type="button"
                                    className={`${styles.dayButton} ${selectedDays.includes(day) ? styles.dayButtonActive : ""}`}
                                    aria-pressed={selectedDays.includes(day)}
                                    onClick={() => toggleScheduleDay(day)}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.dailyGoal}>
                <span>Daily Goal</span>
                <button
                    type="button"
                    className={styles.goalButton}
                    onClick={() => {
                        setGoalOpen((open) => !open);
                        setScheduleOpen(false);
                        setPauseOpen(false);
                        setMoreOpen(false);
                    }}
                >
                    {item.dailyGoalMinutes} <small>min</small>
                </button>

                {goalOpen && (
                    <div className={styles.goalPopover} role="dialog" aria-label={`Change daily goal for ${item.title}`}>
                        <label className={styles.goalLabel}>
                            <span>{goalMinutes} min</span>
                            <input
                                type="range"
                                min="5"
                                max="180"
                                step="5"
                                value={goalMinutes}
                                onChange={(event) => setGoalMinutes(Number(event.target.value))}
                            />
                        </label>
                        <input
                            className={styles.goalInput}
                            type="number"
                            min="5"
                            max="180"
                            value={goalMinutes}
                            onChange={(event) => setGoalMinutes(Number(event.target.value))}
                        />
                        <div className={styles.editorActions}>
                            <button type="button" className={styles.cancelButton} onClick={cancelGoal}>Cancel</button>
                            <button type="button" className={styles.saveButton} onClick={saveGoal}>Save</button>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.progressCell}>
                <span>Progress</span>
                <div className={styles.progressRow}>
                    <div className={styles.progress}>
                        <div className={styles.progressFill} style={{ width: `${item.progressPercent}%` }} />
                    </div>
                    <strong>{item.progressPercent}%</strong>
                </div>
            </div>

            <div className={styles.popoverAnchor}>
                <button
                    type="button"
                    className={styles.pauseButton}
                    onClick={() => {
                        setPauseOpen((open) => !open);
                        setScheduleOpen(false);
                        setGoalOpen(false);
                        setMoreOpen(false);
                    }}
                >
                    <Pause size={14} fill="currentColor" />
                    Pause
                </button>

                {pauseOpen && (
                    <div className={styles.pauseModal} role="dialog" aria-modal="true" aria-label="Pause Cohort">
                        <h3>Pause Cohort</h3>
                        <p>When should this cohort return?</p>
                        <div className={styles.pauseOptions}>
                            {pauseOptions.map((option) => (
                                <label key={option.id} className={styles.pauseOption}>
                                    <input
                                        type="radio"
                                        name={`pause-${item.id}`}
                                        value={option.id}
                                        checked={selectedPauseOption === option.id}
                                        onChange={() => setSelectedPauseOption(option.id)}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                        {selectedPauseOption === "custom" && (
                            <input
                                className={styles.goalInput}
                                type="number"
                                min="1"
                                max="365"
                                value={customPauseDays}
                                onChange={(event) => setCustomPauseDays(Number(event.target.value))}
                            />
                        )}
                        <div className={styles.editorActions}>
                            <button type="button" className={styles.cancelButton} onClick={() => setPauseOpen(false)}>Cancel</button>
                            <button type="button" className={styles.saveButton} onClick={confirmPause}>Pause Cohort</button>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.popoverAnchor}>
                <button
                    type="button"
                    className={styles.moreButton}
                    aria-label={`More actions for ${item.title}`}
                    aria-expanded={moreOpen}
                    onClick={() => {
                        setMoreOpen((open) => !open);
                        setScheduleOpen(false);
                        setGoalOpen(false);
                        setPauseOpen(false);
                    }}
                >
                    <MoreHorizontal size={20} strokeWidth={2.7} />
                </button>

                {moreOpen && (
                    <div className={styles.moreMenu} role="menu" aria-label={`More actions for ${item.title}`}>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setScheduleOpen(true);
                                setGoalOpen(false);
                                setPauseOpen(false);
                                setMoreOpen(false);
                            }}
                        >
                            Edit schedule
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setGoalOpen(true);
                                setScheduleOpen(false);
                                setPauseOpen(false);
                                setMoreOpen(false);
                            }}
                        >
                            Edit daily goal
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setPauseOpen(true);
                                setScheduleOpen(false);
                                setGoalOpen(false);
                                setMoreOpen(false);
                            }}
                        >
                            Pause cohort
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
}
