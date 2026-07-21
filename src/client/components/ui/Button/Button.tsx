import React from "react";
import clsx from "clsx";
import "./button.css";
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

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;

    size?: ButtonSize;

    loading?: boolean;

    fullWidth?: boolean;

    iconOnly?: boolean;

    as?: React.ElementType;
}

export function Button({
                           as: Component = "button",

                           variant = "primary",

                           size = "md",

                           loading = false,

                           fullWidth = false,

                           iconOnly = false,

                           className,

                           disabled,

                           children,

                           ...props
                       }: ButtonProps) {
    return (
        <Component
            className={clsx(
                "btn",

                `btn-${variant}`,

                `btn-${size}`,

                {
                    "btn-block": fullWidth,
                    "btn-icon": iconOnly,
                    "btn-loading": loading,
                },

                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (<><span className="btn-spinner" />{children}</>) : (children)}
        </Component>
    );
}