import React from "react";
import clsx from "clsx";

import styles from "./Layout.module.css";
import { Padding, paddingMap, Radius, radiusMap } from "./layoutTokens";

type Variant =
    | "default"
    | "subtle"
    | "outlined"
    | "elevated"
    | "glass"
    | "brand";

const variants: Record<Variant, string> = {
    default: styles.surface,
    subtle: styles.subtle,
    outlined: styles.outlined,
    elevated: styles.elevated,
    glass: styles.glass,
    brand: styles.surfaceBrand,
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
            className={clsx(variants[variant], className)}
            style={{
                borderRadius: radiusMap[radius],
                padding: paddingMap[padding],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Surface.displayName = "Surface";
