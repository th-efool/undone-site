import { DayProgress } from "./calendarMonth.types";

export const mayDays: DayProgress[] = Array.from(
    { length: 31 },
    (_, index) => ({
        day: index + 1,
        youtube: Math.random(),
        coursera: Math.random(),
        history: Math.random(),
    })
);

export const juneDays: DayProgress[] = Array.from(
    { length: 30 },
    (_, index) => ({
        day: index + 1,
        youtube: Math.random(),
        coursera: Math.random(),
        history: Math.random(),
    })
);

export const julyDays: DayProgress[] = Array.from(
    { length: 31 },
    (_, index) => ({
        day: index + 1,
        youtube: Math.random(),
        coursera: Math.random(),
        history: Math.random(),
    })
);