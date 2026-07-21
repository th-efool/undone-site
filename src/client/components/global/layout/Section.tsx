import React from "react";
import clsx from "clsx";

type Spacing =
    | "none"
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl";

type Background =
    | "transparent"
    | "surface"
    | "subtle"
    | "brand"
    | "momentum"
    | "gradient"
    | "glass";

const spacingMap: Record<Spacing, string> = {
    none: "0",
    xs: "var(--section-space-xs)",
    sm: "var(--section-space-sm)",
    md: "var(--section-space-md)",
    lg: "var(--section-space-lg)",
    xl: "var(--section-space-xl)",
};

const backgroundStyles: Record<Background, React.CSSProperties> = {
    transparent: {},

    surface: {
        background: "var(--color-surface)",
    },

    subtle: {
        background: "var(--color-surface-secondary)",
    },

    brand: {
        background: "var(--gradient-brand)",
        color: "var(--color-text-inverse)",
    },

    momentum: {
        background: "var(--gradient-momentum)",
        color: "var(--color-text-inverse)",
    },

    gradient: {
        background:
            "var(--gradient-hero), var(--color-background)",
    },

    glass: {
        background: "var(--glass-light)",
        backdropFilter: "blur(var(--blur-xl))",
        WebkitBackdropFilter: "blur(var(--blur-xl))",
    },
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
            className={clsx("section", className)}
            style={{
                paddingBlock: spacingMap[spacing],
                ...(hero && {
                    display: "flex",
                    alignItems: "center",
                    minHeight: "100vh",
                    overflow: "hidden",
                }),
                ...backgroundStyles[background],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Section.displayName = "Section";