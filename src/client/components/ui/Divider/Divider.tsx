import React from "react";
import clsx from "clsx";

export interface DividerProps
    extends React.HTMLAttributes<HTMLHRElement> {
    vertical?: boolean;

    inset?: boolean;
}

export function Divider({
                            vertical = false,
                            inset = false,
                            className,
                            style,
                            ...props
                        }: DividerProps) {
    return (
        <hr
            className={clsx(className)}
            style={{
                border: 0,

                margin: 0,

                background: "var(--color-border)",

                ...(vertical
                    ? {
                        width: "1px",
                        height: "100%",
                    }
                    : {
                        width: inset ? "calc(100% - var(--space-8))" : "100%",
                        height: "1px",
                    }),

                ...style,
            }}
            {...props}
        />
    );
}