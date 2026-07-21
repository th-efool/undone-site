import React from "react";
import clsx from "clsx";

import styles from "./Text.module.css";

type Variant =
    | "body"
    | "lead"
    | "small"
    | "muted";

const variantClasses: Record<Variant, string> = {
    body: styles.body,
    lead: styles.lead,
    small: styles.small,
    muted: styles.muted,
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
            className={clsx(styles.text, variantClasses[variant], className)}
            style={style}
            {...props}
        >
            {children}
        </Component>
    );
}
