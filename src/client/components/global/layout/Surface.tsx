import React from "react";
import clsx from "clsx";

type Variant =
    | "default"
    | "subtle"
    | "outlined"
    | "elevated"
    | "glass"
    | "brand";

type Radius =
    | "none"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "full";

type Padding =
    | "none"
    | "sm"
    | "md"
    | "lg"
    | "xl";

const radiusMap: Record<Radius, string> = {
    none: "0",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
    "2xl": "var(--radius-2xl)",
    full: "var(--radius-pill)",
};

const paddingMap: Record<Padding, string> = {
    none: "0",
    sm: "var(--space-4)",
    md: "var(--space-6)",
    lg: "var(--space-8)",
    xl: "var(--space-10)",
};

const variants: Record<Variant, React.CSSProperties> = {
    default: {
        background: "var(--color-surface)",
    },

    subtle: {
        background: "var(--color-surface-secondary)",
    },

    outlined: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
    },

    elevated: {
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-lg)",
    },

    glass: {
        background: "var(--glass-light)",
        backdropFilter: "blur(var(--blur-xl))",
        WebkitBackdropFilter: "blur(var(--blur-xl))",
        border: "1px solid rgba(255,255,255,.18)",
    },

    brand: {
        background: "var(--gradient-brand)",
        color: "var(--color-text-inverse)",
        boxShadow: "var(--shadow-primary)",
    },
};

export interface SurfaceProps
    extends React.HTMLAttributes<HTMLDivElement> {
    as?: React.ElementType;

    variant?: Variant;

    radius?: Radius;

    padding?: Padding;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
    (
        {
            as: Component = "div",
            variant = "default",
            radius = "xl",
            padding = "lg",
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
                borderRadius: radiusMap[radius],
                padding: paddingMap[padding],
                ...variants[variant],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Surface.displayName = "Surface";