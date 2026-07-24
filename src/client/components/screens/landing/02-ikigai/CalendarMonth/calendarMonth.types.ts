export type DayProgress = {
    day: number;

    youtube?: number;
    coursera?: number;
    history?: number;
};

export type CalendarMonthProps = {
    month: string;
    year: number;

    youtubeTotal: string;
    courseraTotal: string;
    historyTotal: string;

    days: DayProgress[];
};