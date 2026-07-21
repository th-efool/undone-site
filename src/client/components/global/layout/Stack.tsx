import React from "react";
import clsx from "clsx";

import styles from "./Layout.module.css";
import { Align, alignMap, Gap, gapMap } from "./layoutTokens";

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
            className={clsx(styles.stack, className)}
            style={{
                gap: gapMap[gap],
                alignItems: alignMap[align],
                ...style,
            }}
            {...props}
        >
            {children}
        </Component>
    )
);

Stack.displayName = "Stack";
