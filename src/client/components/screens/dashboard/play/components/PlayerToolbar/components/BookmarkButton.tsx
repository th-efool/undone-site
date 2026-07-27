import { Bookmark } from "lucide-react";
import clsx from "clsx";

import styles from "../PlayerToolbar.module.css";

export interface BookmarkButtonProps {
    active?: boolean;
    onClick?: () => void;
}

export function BookmarkButton({
                                   active = false,
                                   onClick,
                               }: BookmarkButtonProps) {
    return (
        <button
            className={clsx(
                styles.button,
                active && styles.active,
            )}
            onClick={onClick}
            aria-label="Bookmark"
        >
            <Bookmark size={22} />
        </button>
    );
}