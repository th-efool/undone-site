import React from "react";
import clsx from "clsx";

type Variant =
    | "brand"
    | "momentum"
    | "success"
    | "warning"
    | "danger"
    | "neutral";

type Size =
    | "sm"
    | "md"
    | "lg";

const variantStyles: Record<Variant, React.CSSProperties> = {
    brand: {
        background: "var(--color-brand-soft)",
        color: "var(--color-brand)",
    },

    momentum: {
        background: "rgba(245,158,11,.12)",
        color: "var(--color-momentum)",
    },

    success: {
        background: "rgba(34,197,94,.12)",
        color: "var(--color-success)",
    },

    warning: {
        background: "rgba(245,158,11,.12)",
        color: "var(--color-warning)",
    },

    danger: {
        background: "rgba(239,68,68,.12)",
        color: "var(--color-error)",
    },

    neutral: {
        background: "var(--color-surface-secondary)",
        color: "var(--color-text-secondary)",
    },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
    sm: {
        padding: "var(--space-1) var(--space-3)",
        fontSize: "var(--text-xs)",
    },

    md: {
        padding: "var(--space-2) var(--space-4)",
        fontSize: "var(--text-sm)",
    },

    lg: {
        padding: "var(--space-3) var(--space-5)",
        fontSize: "var(--text-base)",
    },
};

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    (
        {
            variant = "brand",
            size = "md",
            className,
            style,
            children,
            ...props
        },
        ref
    ) => (
        <span
            ref={ref}
            className={clsx(className)}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",

                borderRadius: "var(--radius-pill)",

                fontWeight: "var(--font-semibold)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",

                whiteSpace: "nowrap",

                ...variantStyles[variant],
                ...sizeStyles[size],
                ...style,
            }}
            {...props}
        >
      {children}
    </span>
    )
);

Badge.displayName = "Badge";