"use client";

import { Search, X } from "lucide-react";

import { PillInput } from "../PillInput";
import styles from "./SearchBar.module.css";

export interface SearchBarProps {
    value?: string;
    placeholder?: string;

    onChange?(value: string): void;
    onSubmit?(): void;
    onClear?(): void;

    className?: string;
}

export function SearchBar({
                              value = "",
                              placeholder = "Search topics, creators, playlists, skills...",
                              onChange,
                              onSubmit,
                              className,
                              onClear,
                          }: SearchBarProps) {
    return (
        <form
            className={`${styles.searchBar} ${className ?? ""}`}
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit?.();
            }}
        >
            <PillInput
                className={styles.inputShell}
                type="search"
                value={value}
                placeholder={placeholder}
                leftSlot={<Search size={18} strokeWidth={2.2} className={styles.icon} />}
                rightSlot={value ? <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { onChange?.(""); onClear?.(); }}><X size={15}/></button> : <kbd className={styles.shortcut}>⌘ K</kbd>}
                onChange={(event) => onChange?.(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onChange?.(""); onClear?.(); } }}
            />
        </form>
    );
}