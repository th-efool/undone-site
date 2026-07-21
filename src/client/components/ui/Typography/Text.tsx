import React from "react";
import clsx from "clsx";

type Variant =
    | "body"
    | "lead"
    | "small"
    | "muted";

const styles: Record<Variant, React.CSSProperties> = {
    body: {
        fontSize: "var(--text-base)",
        color: "var(--color-text-primary)",
    },

    lead: {
        fontSize: "var(--text-lg)",
        color: "var(--color-text-secondary)",
    },

    small: {
        fontSize: "var(--text-sm)",
        color: "var(--color-text-secondary)",
    },

    muted: {
        fontSize: "var(--text-sm)",
        color: "var(--color-text-muted)",
    },
};

export interface TextProps
    extends React.HTMLAttributes<HTMLParagraphElement> {
    variant?: Variant;

    as?: React.ElementType;
}

export function Text({
                         variant = "body",
                         as: Component = "p",
                         className,
                         style,
                         children,
                         ...props
                     }: TextProps) {
    return (
        <Component
            className={clsx(className)}
            style={{
                margin: 0,
                lineHeight: "var(--leading-relaxed)",
                ...styles[variant],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    );
}