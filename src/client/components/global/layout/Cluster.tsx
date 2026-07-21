import React from "react";
import clsx from "clsx";

type Gap =
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "8"
    | "10"
    | "12";

const gaps: Record<Gap, string> = {
    "0": "0",
    "1": "var(--space-1)",
    "2": "var(--space-2)",
    "3": "var(--space-3)",
    "4": "var(--space-4)",
    "5": "var(--space-5)",
    "6": "var(--space-6)",
    "8": "var(--space-8)",
    "10": "var(--space-10)",
    "12": "var(--space-12)",
};

type Justify =
    | "start"
    | "center"
    | "end"
    | "between"
    | "around"
    | "evenly";

type Align =
    | "start"
    | "center"
    | "end"
    | "stretch";

const justifyMap: Record<Justify, React.CSSProperties["justifyContent"]> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    between: "space-between",
    around: "space-around",
    evenly: "space-evenly",
};

const alignMap: Record<Align, React.CSSProperties["alignItems"]> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
};

export interface ClusterProps
    extends React.HTMLAttributes<HTMLDivElement> {
    as?: React.ElementType;

    gap?: Gap;

    justify?: Justify;

    align?: Align;

    wrap?: boolean;
}

export const Cluster = React.forwardRef<HTMLDivElement, ClusterProps>(
    (
        {
            as: Component = "div",
            gap = "4",
            justify = "start",
            align = "center",
            wrap = true,
            style,
            className,
            children,
            ...props
        },
        ref
    ) => (
        <Component
            ref={ref}
            className={clsx(className)}
            style={{
                display: "flex",
                flexWrap: wrap ? "wrap" : "nowrap",
                gap: gaps[gap],
                justifyContent: justifyMap[justify],
                alignItems: alignMap[align],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Cluster.displayName = "Cluster";