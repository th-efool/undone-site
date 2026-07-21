import React from "react";
import clsx from "clsx";

type Level = 1 | 2 | 3 | 4 | 5 | 6;

type HeadingElement =
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "div"
    | "span";

const sizeMap: Record<Level, string> = {
    1: "var(--font-hero-size)",
    2: "var(--font-section-title-size)",
    3: "var(--text-4xl)",
    4: "var(--text-3xl)",
    5: "var(--text-2xl)",
    6: "var(--font-card-title-size)",
};

export interface HeadingProps
    extends React.HTMLAttributes<HTMLElement> {
    level?: Level;

    as?: HeadingElement;
}

export function Heading({
                            level = 2,
                            as,
                            className,
                            style,
                            children,
                            ...props
                        }: HeadingProps) {
    const Component = (as ?? `h${level}`) as HeadingElement;

    return (
        <Component
            className={clsx(className)}
            style={{
                margin: 0,
                color: "inherit",
                fontFamily: "var(--font-display)",

                fontSize: sizeMap[level],

                fontWeight:
                    level === 1
                        ? "var(--font-hero-weight)"
                        : level === 2
                            ? "var(--font-section-title-weight)"
                            : level === 6
                                ? "var(--font-card-title-weight)"
                                : "var(--font-bold)",

                lineHeight:
                    level === 1
                        ? "var(--font-hero-line-height)"
                        : level === 2
                            ? "var(--font-section-title-line-height)"
                            : level === 6
                                ? "var(--font-card-title-line-height)"
                                : "var(--leading-tight)",

                letterSpacing:
                    level === 1
                        ? "var(--font-hero-tracking)"
                        : level === 2
                            ? "var(--font-section-title-tracking)"
                            : "var(--tracking-tight)",

                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    );
}