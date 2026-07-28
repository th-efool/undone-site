"use client";

import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type Ref } from "react";

import styles from "./PillInput.module.css";

type BaseProps = {
    leftSlot?: ReactNode;
    rightSlot?: ReactNode;
    radius?: CSSProperties["borderRadius"];
    className?: string;
};

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { mode?: "input" };
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { mode: "textarea" };

export type PillInputProps = InputProps | TextareaProps;

type PillStyle = CSSProperties & { "--pill-input-radius"?: CSSProperties["borderRadius"] };

export const PillInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, PillInputProps>(function PillInput({ leftSlot, rightSlot, radius, className, mode = "input", ...props }, ref) {
    const shellStyle: PillStyle = radius ? { "--pill-input-radius": radius } : {};
    const fieldClassName = `${styles.field} ${mode === "textarea" ? styles.textarea : ""}`;

    return (
        <label className={`${styles.shell} ${className ?? ""}`} style={shellStyle}>
            {leftSlot && <span className={styles.slot}>{leftSlot}</span>}
            {mode === "textarea" ? (
                <textarea ref={ref as Ref<HTMLTextAreaElement>} className={fieldClassName} {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
            ) : (
                <input ref={ref as Ref<HTMLInputElement>} className={fieldClassName} {...(props as InputHTMLAttributes<HTMLInputElement>)} />
            )}
            {rightSlot && <span className={styles.slot}>{rightSlot}</span>}
        </label>
    );
});
