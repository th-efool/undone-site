import { Scan } from "lucide-react";
import clsx from "clsx";

import styles from "../PlayerToolbar.module.css";

export interface CaptureButtonProps {
    active?: boolean;
    onClick?: () =>void;
}

export function CaptureButton({
                                  active = false,
                                  onClick,
                              }: CaptureButtonProps) {
    return (
        <button
            className={clsx(
                styles.button,
                active && styles.active,
            )}
            onClick={onClick}
            aria-label="Capture"
        >
            <Scan size={22} />
        </button>
    );
}