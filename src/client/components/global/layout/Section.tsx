import React from "react";
import clsx from "clsx";

import styles from "./Layout.module.css";
import { Spacing, spacingMap } from "./layoutTokens";

type Background =
    | "transparent"
    | "surface"
    | "subtle"
    | "brand"
    | "momentum"
    | "gradient"
    | "glass";

const backgroundClasses: Record<Background, string> = {
    transparent: "",
    surface: styles.surfaceBackground,
    subtle: styles.subtle,
    brand: styles.brand,
    momentum: styles.momentum,
    gradient: styles.gradient,
    glass: styles.glass,
};

export interface SectionProps
    extends React.HTMLAttributes<HTMLElement> {
    as?: React.ElementType;

    spacing?: Spacing;

    background?: Background;

    hero?: boolean;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
    (
        {
            as: Component = "section",
            spacing = "lg",
            background = "transparent",
            hero = false,
            style,
            className,
            children,
            ...props
        },
        ref
    ) => (
        <Component
            ref={ref}
            className={clsx(
                styles.section,
                backgroundClasses[background],
                hero && styles.hero,
                className
            )}
            style={{
                paddingBlock: spacingMap[spacing],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Section.displayName = "Section";
