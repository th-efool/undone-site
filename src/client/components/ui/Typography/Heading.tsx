import React from "react";
import clsx from "clsx";

import styles from "./Heading.module.css";

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

const levelClasses: Record<Level, string> = {
    1: styles.level1,
    2: styles.level2,
    3: styles.level3,
    4: styles.level4,
    5: styles.level5,
    6: styles.level6,
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
                            role,
                            "aria-level": ariaLevel,
                            ...props
                        }: HeadingProps) {
    const Component = (as ?? `h${level}`) as HeadingElement;
    const needsHeadingSemantics = Component === "div" || Component === "span";

    return (
        <Component
            className={clsx(styles.heading, levelClasses[level], className)}
            role={role ?? (needsHeadingSemantics ? "heading" : undefined)}
            aria-level={ariaLevel ?? (needsHeadingSemantics ? level : undefined)}
            style={style}
            {...props}
        >
            {children}
        </Component>
    );
}
