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
    | "12"
    | "16";

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
    "16": "var(--space-16)",
};

type Align =
    | "stretch"
    | "start"
    | "center"
    | "end";

export interface StackProps
    extends React.HTMLAttributes<HTMLDivElement> {
    as?: React.ElementType;

    gap?: Gap;

    align?: Align;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
    (
        {
            as: Component = "div",
            gap = "6",
            align = "stretch",
            className,
            style,
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
                flexDirection: "column",
                gap: gaps[gap],
                alignItems: align,
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Stack.displayName = "Stack";