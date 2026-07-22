import React from "react";
import clsx from "clsx";

import styles from "./Button.module.css";

export type ButtonVariant =
    | "primary"
    | "secondary"
    | "ghost"
    | "outline"
    | "momentum"
    | "danger";

export type ButtonSize =
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl";

type ButtonOwnProps<T extends React.ElementType = "button"> = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    iconOnly?: boolean;
    as?: T;
};

export type ButtonProps<T extends React.ElementType = "button"> =
    ButtonOwnProps<T> &
    Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

export function Button<T extends React.ElementType = "button">({
                                                                   as,
                                                                   variant = "primary",
                                                                   size = "md",
                                                                   loading = false,
                                                                   fullWidth = false,
                                                                   iconOnly = false,
                                                                   className,
                                                                   disabled,
                                                                   children,
                                                                   ...props
                                                               }: ButtonProps<T>) {
    const Component = (as ?? "button") as React.ElementType;

    const isButton = Component === "button";
    const isDisabled = Boolean(disabled || loading);

    return (
        <Component
            className={clsx(
                styles.root,
                styles[variant],
                styles[size],
                {
                    [styles.block]: fullWidth,
                    [styles.icon]: iconOnly,
                    [styles.loading]: loading,
                },
                className
            )}
            aria-busy={loading || undefined}
            aria-disabled={isDisabled || undefined}
            {...(isButton ? { disabled: isDisabled } : {})}
            {...props}
        >
            {loading ? (
                <>
                    <span className={styles.spinner} />
                    {children}
                </>
            ) : (
                children
            )}
        </Component>
    );
}